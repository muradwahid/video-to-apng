import { supabase } from './supabase';
import type { Project } from '../types/supabase';
import { TimelineState } from '../types';

export async function getUserProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id,name,thumbnail_url,duration_seconds,last_opened_at,created_at,updated_at')
    .order('last_opened_at', { ascending: false });
  if (error) throw error;
  return data as Project[];
}

export async function loadProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(name = 'Untitled Project'): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, user_id: user.id, state: {} })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function saveProject(
  id: string,
  state: TimelineState,
  name?: string,
  durationSeconds?: number
): Promise<void> {
  const patch: Record<string, any> = { state };
  if (name !== undefined) patch.name = name;
  if (durationSeconds !== undefined) patch.duration_seconds = durationSeconds;
  
  const { error } = await supabase.from('projects').update(patch).eq('id', id);
  if (error) throw error;
}

export async function markProjectOpened(projectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('projects')
    .update({ last_opened_at: new Date().toISOString() })
    .eq('id', projectId);
    
  await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, last_project_id: projectId },
      { onConflict: 'user_id' }
    );
}

export async function getLastProjectId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('last_project_id')
    .single();
  
  if (error) return null;
  return data?.last_project_id ?? null;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function duplicateProject(id: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  
  const source = await loadProject(id);
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: `${source.name} (Copy)`,
      state: source.state,
      duration_seconds: source.duration_seconds,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadThumbnail(
  projectId: string,
  blob: Blob
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  
  const path = `${user.id}/${projectId}/thumb.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('project-thumbnails')
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('project-thumbnails').getPublicUrl(path);
  
  await supabase
    .from('projects')
    .update({ thumbnail_url: data.publicUrl })
    .eq('id', projectId);
    
  return data.publicUrl;
}
