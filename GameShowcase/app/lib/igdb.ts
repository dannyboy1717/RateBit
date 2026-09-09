import { supabase } from "./supabase";
import { GamePlatform } from "../types/supabase";

/** Normalized game returned by the igdb-search Edge Function. */
export type IgdbGame = {
  id: number;
  name: string;
  releaseYear: number | null;
  developer: string | null;
  coverUrl: string | null;
  thumbUrl: string | null;
  /** Raw IGDB platform names — map with mapIgdbPlatforms before use. */
  platforms: string[];
};

/**
 * Shown in the platform picker before the user searches, so the common case
 * needs no network round-trip. These are IGDB's exact names — the picker stores
 * whatever string it hands back, and matching IGDB's spelling keeps hand-picked
 * platforms consistent with ones seeded from a game match.
 */
export const COMMON_PLATFORMS: GamePlatform[] = [
  "PC (Microsoft Windows)",
  "PlayStation 5",
  "PlayStation 4",
  "PlayStation 3",
  "PlayStation 2",
  "PlayStation",
  "Xbox Series X|S",
  "Xbox One",
  "Xbox 360",
  "Xbox",
  "Nintendo Switch 2",
  "Nintendo Switch",
  "Nintendo 3DS",
  "Nintendo DS",
  "Game Boy Advance",
  "Super Nintendo Entertainment System",
  "PlayStation Vita",
  "PlayStation Portable",
];

/**
 * Platform names as IGDB gave them, deduplicated and in IGDB's order.
 *
 * This used to fold IGDB's names onto a fixed list of 15 and drop the rest,
 * which silently lost N64, GameCube, Dreamcast, mobile and everything else.
 * The column is free text now, so the names pass straight through.
 */
export function mapIgdbPlatforms(names: string[]): GamePlatform[] {
  return Array.from(new Set(names.filter(Boolean)));
}

/**
 * Searches IGDB via the Edge Function, which holds the API credentials.
 *
 * Never throws: search is an optional convenience on top of manual entry, so a
 * failure here degrades to an empty result list rather than blocking the user
 * from adding a game.
 */
export async function searchIgdbGames(query: string): Promise<IgdbGame[]> {
  try {
    const { data, error } = await supabase.functions.invoke<{ results?: IgdbGame[] }>("igdb-search", {
      body: { query },
    });

    if (error) {
      console.warn("IGDB search failed:", error.message);
      return [];
    }

    return data?.results ?? [];
  } catch (err) {
    console.warn("IGDB search failed:", err);
    return [];
  }
}

/**
 * Searches IGDB's platform list for the picker.
 *
 * Degrades to an empty list on failure like searchIgdbGames, since the picker
 * always offers COMMON_PLATFORMS and free-text entry as a fallback.
 */
export async function searchIgdbPlatforms(query: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke<{ results?: string[] }>("igdb-search", {
      body: { query, type: "platform" },
    });

    if (error) {
      console.warn("IGDB platform search failed:", error.message);
      return [];
    }

    return data?.results ?? [];
  } catch (err) {
    console.warn("IGDB platform search failed:", err);
    return [];
  }
}
