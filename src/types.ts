export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
}
export interface Game {
  id: string;
  kind: "daily" | "custom";
  daily_date: string | null;
  name: string | null;
  created_at: string;
  external_key?: string | null;
  played_on?: string | null;
  replay_id?: string | null;
  timer_seconds?: number;
  correct_answers?: CorrectAnswer[] | null;
  answers_source_url?: string | null;
  answers_backfill_checked_at?: string | null;
}
/** Original photograph metadata shared by all players of a game. */
export interface CorrectAnswer {
  readonly actual_year: number | null;
  readonly actual_location: {
    readonly lat: number;
    readonly lng: number;
  } | null;
  readonly country?: string | null;
  readonly description?: string | null;
}
export interface PictureResult {
  actual_year?: number | null;
  actual_location?: { lat: number; lng: number } | null;
  points: number;
  years_off: number | null;
  distance_km: number | null;
}
export interface Result {
  game_id: string;
  player_id: string;
  points: number;
  rounds?: PictureResult[] | null;
  daily_number?: number | null;
}
export interface Standing extends Profile {
  games: number;
  wins: number;
  points: number;
  winRate: number;
  average: number;
}
