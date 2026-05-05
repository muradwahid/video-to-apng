import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Film, Play, Search, Clock, Plus, MoreVertical, Loader2 } from "lucide-react";
import { UserMenu } from "../components/UserMenu";
import { getUserProjects, createProject, deleteProject, renameProject, duplicateProject, getLastProjectId } from "../lib/projectService";
import type { Project } from "../types/supabase";

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [projs, lId] = await Promise.all([
          getUserProjects(),
          getLastProjectId()
        ]);
        setProjects(projs);
        setLastProjectId(lId);
      } catch (e: any) {
        console.error("Failed to load dashboard:", e);
        setErrorMsg(e.message || "Failed to load projects. Be sure to run the Supabase initialization SQL script.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreateProject = async () => {
    setCreating(true);
    try {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const date = new Date();
      const defaultName = `Untitled Project — ${monthNames[date.getMonth()]} ${date.getDate()}`;
      const proj = await createProject(defaultName);
      navigate(`/editor/${proj.id}`);
    } catch (e: any) {
      console.error("Failed to create project", e);
      setErrorMsg(`Failed to create project: ${e.message || 'Check console'}. You likely need to run the SQL initialization script in your Supabase SQL Editor.`);
      setCreating(false);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await renameProject(id, newName);
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    } catch (e) {
      console.error("Rename failed", e);
    }
  };

  const handleDelete = async (id: string) => {
    // Replaced window.confirm with a simple delete for now, as confirm often breaks in iframe
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (lastProjectId === id) setLastProjectId(null);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const newProj = await duplicateProject(id);
      setProjects(prev => [newProj, ...prev]);
    } catch (e) {
      console.error("Duplicate failed", e);
    }
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const lastProject = projects.find(p => p.id === lastProjectId);
  const [dismissBanner, setDismissBanner] = useState(sessionStorage.getItem('dismissResumeBanner') === 'true');

  const onDismissBanner = () => {
    sessionStorage.setItem('dismissResumeBanner', 'true');
    setDismissBanner(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-300 font-sans">
      {/* Top Navigation */}
      <header className="h-16 border-b border-[#2a2a2a] px-6 flex items-center justify-between sticky top-0 bg-[#0A0A0A] z-40">
        <div className="flex items-center gap-2">
          <Film className="text-white relative top-[0.5px]" size={20} />
          <span className="text-lg font-bold text-white tracking-tight">Cortex</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCreateProject}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            New Project
          </button>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 space-y-8">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl flex items-start justify-between flex-col gap-4">
            <p className="font-semibold text-lg">{errorMsg}</p>
            {errorMsg.includes('schema cache') || errorMsg.includes('public.projects') ? (
              <div className="text-sm bg-black/50 p-4 rounded-lg w-full overflow-hidden">
                <p className="mb-2 text-gray-300">It looks like the Supabase database tables are missing. Please go to your Supabase project's SQL Editor and run the contents of the <code>supabase_schema.sql</code> file, or run the following SQL:</p>
                <textarea 
                  readOnly 
                  className="w-full h-48 bg-[#111] text-xs font-mono text-gray-400 p-3 rounded outline-none border border-[#333]" 
                  value={`-- 1. Create projects table\nCREATE TABLE IF NOT EXISTS public.projects (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,\n  name text NOT NULL,\n  thumbnail_url text,\n  duration_seconds integer DEFAULT 30,\n  state jsonb DEFAULT '{}'::jsonb,\n  last_opened_at timestamp with time zone,\n  created_at timestamp with time zone DEFAULT now(),\n  updated_at timestamp with time zone DEFAULT now()\n);\n\n-- 2. Create profiles table\nCREATE TABLE IF NOT EXISTS public.profiles (\n  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,\n  email text,\n  full_name text,\n  avatar_url text,\n  created_at timestamp with time zone DEFAULT now()\n);\n\n-- 3. Create user preferences table\nCREATE TABLE IF NOT EXISTS public.user_preferences (\n  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,\n  last_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,\n  theme text DEFAULT 'dark'\n);\n\n-- 4. Enable RLS and setup storage (see supabase_schema.sql for the full script)`}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Resume Banner */}
        {lastProject && !dismissBanner && (
          <div className="bg-gradient-to-r from-orange-950/40 to-transparent border-l-4 border-orange-500 rounded-r-xl border-t border-r border-b border-white/5 p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Play className="text-orange-400 ml-1" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  Resume: <span className="font-bold">{lastProject.name}</span>
                </h3>
                <p className="text-xs text-orange-400/60 mt-0.5 flex items-center gap-1">
                  <Clock size={12} /> edited {new Date(lastProject.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(`/editor/${lastProject.id}`)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded text-sm font-medium transition-colors"
              >
                Open
              </button>
              <button onClick={onDismissBanner} className="p-2 text-gray-500 hover:text-white transition-colors">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Projects Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">Recent Projects</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#161616] border border-[#2a2a2a] rounded-lg text-sm text-white focus:outline-none focus:border-white/30 w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse bg-[#161616] border border-white/5 rounded-xl aspect-[4/3]"></div>
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProjects.map(proj => (
                <ProjectCard 
                  key={proj.id} 
                  project={proj} 
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onClick={() => navigate(`/editor/${proj.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-2xl bg-[#111]">
              <Film className="mx-auto mb-4 opacity-20 text-white" size={48} />
              <p className="text-lg font-medium text-white mb-2">No projects yet</p>
              <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">Start building something great. Create a new project to open the editor.</p>
              <button 
                onClick={handleCreateProject}
                disabled={creating}
                className="px-6 py-2.5 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-semibold transition-colors"
              >
                + Create Your First Project
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ProjectCard({ project, onRename, onDelete, onDuplicate, onClick }: { 
  key?: React.Key;
  project: Project;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const submitRename = () => {
    setEditing(false);
    if (editName.trim() && editName !== project.name) {
      onRename(project.id, editName);
    } else {
      setEditName(project.name);
    }
  };

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] hover:border-gray-600 rounded-xl overflow-hidden group transition-all duration-300 relative flex flex-col">
      <div 
        className="aspect-video relative bg-[#111] overflow-hidden cursor-pointer"
        onClick={onClick}
      >
        {project.thumbnail_url ? (
          <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-[#1a1a1a] flex items-center justify-center">
            <Film size={32} className="text-[#333]" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="ml-1" size={20} fill="currentColor" />
          </div>
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-2">
          {editing ? (
            <input 
              autoFocus
              className="text-sm font-semibold text-white bg-black/50 border border-blue-500/50 rounded px-1.5 py-0.5 outline-none w-full"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setEditing(false); setEditName(project.name); } }}
            />
          ) : (
            <h3 
              className="text-sm font-semibold text-white line-clamp-1 group-hover:text-blue-400 transition-colors cursor-text title-hover"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            >
              {project.name}
            </h3>
          )}
          
          <div className="relative" onMouseLeave={() => setMenuOpen(false)}>
            <button 
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 text-gray-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl z-20 py-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuOpen(false); onClick(); }} className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#333]">Open</button>
                <button onClick={() => { setMenuOpen(false); setEditing(true); }} className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#333]">Rename</button>
                <button onClick={() => { setMenuOpen(false); onDuplicate(project.id); }} className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-[#333]">Duplicate</button>
                <div className="my-1 border-t border-[#333]"></div>
                <button onClick={() => { setMenuOpen(false); onDelete(project.id); }} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#333]">Delete</button>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
          <span>{new Date(project.last_opened_at || project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
          <span>{Math.floor((project.duration_seconds || 0) / 60)}:{((project.duration_seconds || 0) % 60).toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
}
