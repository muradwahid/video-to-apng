import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Settings, FolderOpen, User } from 'lucide-react';
import type { Profile } from '../types/supabase';

export function UserMenu() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted && user) {
          setSessionUser(user);
          const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (mounted && data) {
             setProfile(data);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUser();

    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => {
      mounted = false;
      window.removeEventListener('mousedown', handler);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    navigate('/auth');
  };

  if (!sessionUser) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-[#222] border border-[#333] flex items-center justify-center overflow-hidden hover:border-gray-400 transition-colors"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <User size={16} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl py-1 z-50">
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <p className="text-sm font-medium text-white truncate">{profile?.full_name || sessionUser.email}</p>
            <p className="text-xs text-gray-500 truncate">{sessionUser.email}</p>
          </div>
          <div className="py-1">
            <button 
              onClick={() => { setOpen(false); navigate('/dashboard'); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a1a] flex items-center gap-2"
            >
              <FolderOpen size={14} /> My Projects
            </button>
            <button 
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#1a1a1a] flex items-center gap-2"
            >
              <Settings size={14} /> Settings
            </button>
          </div>
          <div className="py-1 border-t border-[#2a2a2a]">
            <button 
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#1a1a1a] flex items-center gap-2"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
