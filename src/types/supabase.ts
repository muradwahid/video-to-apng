export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  state: any; // EditorState
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  last_project_id: string | null;
  theme: 'dark' | 'darkest' | 'light' | 'high-contrast';
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
