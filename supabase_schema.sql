-- Run this script in your Supabase SQL Editor

-- 1. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  thumbnail_url text,
  duration_seconds integer DEFAULT 30,
  state jsonb DEFAULT '{}'::jsonb,
  last_opened_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Create profiles table (optional, but good for user data)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create user preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  theme text DEFAULT 'dark'
);

-- 4. Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Projects: users can only see and edit their own projects
CREATE POLICY "Users can manage their own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id);

-- Profiles: users can read all profiles, but output their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Preferences: users can only see and edit their own preferences
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 6. Storage Bucket for Thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('project-thumbnails', 'project-thumbnails', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'project-thumbnails');
CREATE POLICY "Users can upload their own thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own thumbnails" ON storage.objects FOR UPDATE USING (bucket_id = 'project-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'project-thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger to create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
