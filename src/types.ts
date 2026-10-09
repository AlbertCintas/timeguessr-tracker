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
}
export interface PictureResult {
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
