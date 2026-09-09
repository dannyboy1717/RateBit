/**
 * igdb-search — proxies game and platform searches to IGDB (Twitch's game
 * database).
 *
 * Request body: { query: string, type?: "game" | "platform" }. "game" is the
 * default and returns IgdbGame objects; "platform" returns bare platform-name
 * strings for the platform picker. The default keeps older app builds working
 * against this function unchanged.
 *
 * This function exists so the IGDB client secret never reaches the app. An Expo
 * JS bundle ships inside the IPA/APK and unzips to near-plaintext, so anything
 * embedded there is extractable. IGDB also sends no CORS headers, so a direct
 * browser call would fail outright on web.
 *
 * Secrets are provided by the Supabase runtime, never committed:
 *   npx supabase secrets set IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=...
 *
 * verify_jwt is left at its default (on), so only signed-in users can search —
 * supabase.functions.invoke() attaches the caller's session JWT automatically.
 */

const IGDB_CLIENT_ID = Deno.env.get("IGDB_CLIENT_ID");
const IGDB_CLIENT_SECRET = Deno.env.get("IGDB_CLIENT_SECRET");

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
const IGDB_PLATFORMS_URL = "https://api.igdb.com/v4/platforms";
const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";

const RESULT_LIMIT = 15;
/** Platform names are one line each, so more of them fit a picker usefully. */
const PLATFORM_RESULT_LIMIT = 25;
/**
 * Over-fetch so there is something to re-rank. IGDB's relevance order buries
 * popular titles — a search for "zelda" returns neither Breath of the Wild nor
 * Tears of the Kingdom in the first 15, while ranking a bootleg 6th.
 */
const CANDIDATE_LIMIT = 100;
/** Re-mint slightly early so a token can't expire mid-flight. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/**
 * How much weight popularity carries against IGDB's own relevance order.
 * Popularity-dominant, because within an already-relevant result set the
 * well-known entry is almost always the one being looked for. IGDB's relevance
 * is kept only as a light corrective, since it ranks a 1986 original and a
 * Game & Watch spin-off above Breath of the Wild.
 */
const POPULARITY_WEIGHT = 0.8;
const RELEVANCE_WEIGHT = 1 - POPULARITY_WEIGHT;
/**
 * Enough to pull an exact title match above a more popular sibling — "Yakuza 4"
 * should beat Yakuza 0 — but deliberately not enough to float an obscure exact
 * match over a household name, which is why it is a nudge rather than an
 * override. A short query like "zelda" exactly matches a 1989 Game & Watch
 * title that nobody is searching for.
 */
const EXACT_MATCH_BONUS = 0.5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Shape returned to the client. Mirrors IgdbGame in app/lib/igdb.ts. */
type IgdbGame = {
  id: number;
  name: string;
  releaseYear: number | null;
  developer: string | null;
  coverUrl: string | null;
  thumbUrl: string | null;
  platforms: string[];
};

type IgdbRawGame = {
  id: number;
  name?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  platforms?: { name?: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { name?: string };
  }[];
  /** Popularity signals. Absent when the fallback query is used. */
  follows?: number;
  total_rating_count?: number;
};

/**
 * Cached across invocations on a warm instance. Twitch client-credentials
 * tokens last ~60 days, so cold starts are the only time we mint a new one.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS) {
    return cachedToken.token;
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", IGDB_CLIENT_ID!);
  url.searchParams.set("client_secret", IGDB_CLIENT_SECRET!);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, { method: "POST" });

  if (!response.ok) {
    // Never echo the response body — it can contain the credentials we sent.
    throw new Error(`Twitch token request failed (${response.status})`);
  }

  const payload = await response.json();

  if (!payload.access_token) {
    throw new Error("Twitch token response contained no access_token");
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 0) * 1000,
  };

  return cachedToken.token;
}

/**
 * APICalypse has no parameter binding, so the query is interpolated directly
 * into the request body. Strip the characters that could break out of the
 * quoted string and inject extra clauses.
 */
function escapeSearchTerm(term: string): string {
  return term.replace(/[\\"\n\r;]/g, " ").trim().slice(0, 100);
}

function pickDeveloper(game: IgdbRawGame): string | null {
  const companies = game.involved_companies ?? [];
  const developer = companies.find((entry) => entry.developer)?.company?.name;
  const publisher = companies.find((entry) => entry.publisher)?.company?.name;

  return developer ?? publisher ?? null;
}

function normalize(game: IgdbRawGame): IgdbGame {
  const imageId = game.cover?.image_id;

  return {
    id: game.id,
    name: game.name ?? "Unknown",
    releaseYear: game.first_release_date
      ? new Date(game.first_release_date * 1000).getUTCFullYear()
      : null,
    developer: pickDeveloper(game),
    coverUrl: imageId ? `${IGDB_IMAGE_BASE}/t_cover_big/${imageId}.jpg` : null,
    thumbUrl: imageId ? `${IGDB_IMAGE_BASE}/t_thumb/${imageId}.jpg` : null,
    platforms: (game.platforms ?? [])
      .map((platform) => platform.name)
      .filter((name): name is string => Boolean(name)),
  };
}

/** Strip punctuation and case so "Persona 5" matches "persona 5". */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Re-orders IGDB's relevance list to favour titles people have actually heard
 * of, without discarding relevance entirely.
 *
 * IGDB ranks "zelda" by textual relevance alone, which puts a 1986 original and
 * a Shenzhen bootleg above Breath of the Wild. Sorting purely by popularity
 * over-corrects the other way — searching "Yakuza 4" would surface the more
 * popular Yakuza 0 first — so an exact title match outranks both signals.
 *
 * Returns a new array; the input is not mutated.
 */
function rankResults(games: IgdbRawGame[], searchTerm: string): IgdbRawGame[] {
  if (games.length === 0) {
    return games;
  }

  const target = normalizeName(searchTerm);
  const popularityOf = (game: IgdbRawGame) => (game.follows ?? 0) + (game.total_rating_count ?? 0);
  const maxPopularity = Math.max(...games.map(popularityOf), 0);

  // Log-scaled: the gap between 0 and 500 followers matters far more than the
  // gap between 50,000 and 50,500, and raw counts are heavily long-tailed.
  const popularityScore = (game: IgdbRawGame) =>
    maxPopularity > 0 ? Math.log1p(popularityOf(game)) / Math.log1p(maxPopularity) : 0;

  return games
    .map((game, index) => {
      // 1.0 for IGDB's top hit, decaying to ~0 for the last candidate.
      const relevance = 1 - index / games.length;
      const exact = game.name && normalizeName(game.name) === target ? EXACT_MATCH_BONUS : 0;

      return {
        game,
        index,
        score: exact + RELEVANCE_WEIGHT * relevance + POPULARITY_WEIGHT * popularityScore(game),
      };
    })
    // Ties fall back to IGDB's ordering rather than an arbitrary sort.
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.game);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Platform-name lookup for the platform picker.
 *
 * Returns bare names rather than IDs: the Games table stores the platform as
 * text the user chose, so a name is the whole payload. Deduplicated because
 * IGDB carries a few same-named entries.
 */
async function searchPlatforms(searchTerm: string, token: string): Promise<Response> {
  const response = await fetch(IGDB_PLATFORMS_URL, {
    method: "POST",
    headers: {
      "Client-ID": IGDB_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    // `search` is supported on /platforms, and as with /games it cannot be
    // combined with `sort` — IGDB's own relevance order is what comes back.
    body: [
      `search "${searchTerm}";`,
      "fields name;",
      `limit ${PLATFORM_RESULT_LIMIT};`,
    ].join("\n"),
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedToken = null;
    }

    console.error(`IGDB platform search failed (${response.status})`);
    return jsonResponse({ results: [], error: "IGDB platform search failed." }, 502);
  }

  const platforms: { name?: string }[] = await response.json();
  const names = platforms
    .map((platform) => platform.name)
    .filter((name): name is string => Boolean(name));

  return jsonResponse({ results: Array.from(new Set(names)) }, 200);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
    console.error("IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are not configured");
    return jsonResponse({ results: [], error: "IGDB is not configured." }, 500);
  }

  try {
    // `type` is optional and defaults to "game", so builds that predate the
    // platform picker keep working against this function unchanged.
    const { query, type } = await request.json();

    if (typeof query !== "string" || query.trim().length < 2) {
      return jsonResponse({ results: [] }, 200);
    }

    const searchTerm = escapeSearchTerm(query);

    if (!searchTerm) {
      return jsonResponse({ results: [] }, 200);
    }

    const token = await getAccessToken();

    if (type === "platform") {
      return await searchPlatforms(searchTerm, token);
    }

    // Note: `search` cannot be combined with `sort` in APICalypse — IGDB
    // returns results in its own relevance order.
    //
    // The where clause trims the noise that otherwise dominates results:
    //   version_parent = null  drops regional/re-release duplicates, which
    //                          often carry no developer or cover.
    //   game_type = (...)      keeps main games (0), standalone expansions (4),
    //                          remakes (8), remasters (9) and expanded games
    //                          (10), while dropping DLC, mods, packs and
    //                          updates. Remakes are kept deliberately: people
    //                          track e.g. RE4 (2005) and RE4 (2023) separately.
    const buildQuery = (withPopularity: boolean) =>
      [
        `search "${searchTerm}";`,
        "fields name, cover.image_id, first_release_date, platforms.name,",
        "       involved_companies.company.name,",
        "       involved_companies.developer, involved_companies.publisher",
        withPopularity ? "       , follows, total_rating_count;" : ";",
        "where version_parent = null & game_type = (0,4,8,9,10);",
        `limit ${withPopularity ? CANDIDATE_LIMIT : RESULT_LIMIT};`,
      ].join("\n");

    const runSearch = (withPopularity: boolean) =>
      fetch(IGDB_GAMES_URL, {
        method: "POST",
        headers: {
          "Client-ID": IGDB_CLIENT_ID,
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/plain",
        },
        body: buildQuery(withPopularity),
      });

    let ranked = true;
    let response = await runSearch(true);

    // A 400 means IGDB rejected the request body — most likely one of the
    // popularity fields. Degrade to the plain query so search keeps working
    // rather than failing outright, and make the reason visible in the logs.
    if (response.status === 400) {
      console.error("IGDB rejected the ranked query; falling back to unranked search.");
      ranked = false;
      response = await runSearch(false);
    }

    if (!response.ok) {
      // A 401 usually means the cached token was revoked server-side; drop it
      // so the next request mints a fresh one.
      if (response.status === 401) {
        cachedToken = null;
      }

      console.error(`IGDB search failed (${response.status})`);
      return jsonResponse({ results: [], error: "IGDB search failed." }, 502);
    }

    const games: IgdbRawGame[] = await response.json();
    const ordered = ranked ? rankResults(games, searchTerm) : games;

    return jsonResponse({ results: ordered.slice(0, RESULT_LIMIT).map(normalize) }, 200);
  } catch (err) {
    console.error("igdb-search error:", err instanceof Error ? err.message : err);
    return jsonResponse({ results: [], error: "IGDB search failed." }, 500);
  }
});
