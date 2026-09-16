export type ActivitySession = {
  id: string; title: string; slug: string;
  cover_image_url: string | null; session_date: string | null;
  youtube_url?: string | null;
  activity_types: { name: string; slug: string } | null;
};
export type MediaVideo = { id: string; title: string; youtube_url: string; display_order: number };
export type Executive = {
  id: string; full_name: string; position: string; panel: string;
  photo_url: string | null; session_year?: string;
  quote?: string; link?: string;
};
export type PulseOlympiad = { id: string; name: string; exam_date: string | null; registration_deadline: string | null };
export type LeaderboardEntry = { name: string; score: number };
export type Leaderboard = { olympiad_id: string; olympiad_name: string; entries: LeaderboardEntry[] };
