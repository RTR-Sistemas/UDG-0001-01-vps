export interface VideoProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface VideoPost {
  id: string;
  user_id: string;
  content: string | null;
  created_at: string;
  media_urls: string[] | null;
  post_type: string | null;
  profiles?: VideoProfile | null;
  likes?: { id: string; user_id: string }[] | null;
  comments?: { id: string }[] | null;
  post_votes?: { id: string; user_id: string; vote_type: string }[] | null;
  share_count?: number;
  [key: string]: unknown;
}

export type Viewer = { id?: string } | null;