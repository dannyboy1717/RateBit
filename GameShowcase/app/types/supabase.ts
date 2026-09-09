export type GameStatus = 
  | "Started" 
  | "Finished" 
  | "Completed" 
  | "Continuous" 
  | "Dropped" 
  | "Paused" 
  | "Plan to Play";
  
/**
 * Free-form since the platform migration: IGDB tracks ~200 platforms and adds
 * more, so the app searches IGDB's /platforms endpoint rather than carrying its
 * own list. The database column is plain text and IGDB is the source of truth
 * for names. COMMON_PLATFORMS in app/lib/igdb.ts holds the shortlist the picker
 * offers before the user types.
 */
export type GamePlatform = string;

export interface Game {
  id: number;
  /**
   * Owner. Every read is filtered by this and the RLS policy keys off it, so a
   * row without it is invisible to everyone — including the person who created
   * it. Always set explicitly on insert rather than trusting a column default.
   */
  user_id: string;
  Name: string | null;
  Started: string | null;
  Finished: string | null;
  Rating: number | null;
  Status: GameStatus | null;
  "Developer/Publisher": string | null;
  Platform: GamePlatform | null;
  Playtime: string | null;
  Bought: string | null;
  Cost: string | null;
  Comments: string | null;
  IgdbId: number | null;
  CoverUrl: string | null;
}