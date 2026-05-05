import React, { useRef, useState } from "react";
import { cn, formatTime } from "@/src/lib/utils";
import { TimelineState } from "@/src/types";
import { useWorkspaceStore, WorkspaceLayout } from "@/src/store/workspaceStore";
import { Settings, Command, LayoutTemplate, Download, Upload, ArrowLeft } from "lucide-react";
import { UserMenu } from "./UserMenu";
import { useNavigate } from "react-router-dom";
import { renameProject } from "../lib/projectService";

interface AppHeaderProps {
  activeTab: "media" | "effects" | "color" | "audio" | "export" | "graphics" | "captions";
  setActiveTab: (tab: "media" | "effects" | "color" | "audio" | "export" | "graphics" | "captions") => void;
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  setShowVideoExportModal: (show: boolean) => void;
  theme: any;
  setShowShortcuts: (s: boolean) => void;
  setShowSettings: (s: boolean) => void;
  onImportProject?: (file: File) => void;
  onExportProject?: () => void;
  collabUsers?: any[];
}

export function AppHeader({ activeTab, setActiveTab, state, setState, setShowVideoExportModal, theme, setShowShortcuts, setShowSettings, onImportProject, onExportProject, collabUsers = [] }: AppHeaderProps) {
  const { activeLayout, setActiveLayout } = useWorkspaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleNameBlur = async () => {
    setEditingName(false);
    if (!tempName.trim()) return;
    const finalName = tempName.trim();
    if (finalName !== state.currentProjectName && state.currentProjectId) {
      try {
        await renameProject(state.currentProjectId, finalName);
        setState((s: any) => ({ ...s, currentProjectName: finalName }));
      } catch (e) {
        console.error("Rename failed", e);
      }
    }
  };

  return (
    <header className="h-12 border-b flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-20" style={{ borderColor: theme.borderStrong }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 mr-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-1.5 text-gray-400 hover:text-white rounded bg-white/5 hover:bg-white/10 transition-colors mr-2" 
              title="Back to Dashboard"
            >
               <ArrowLeft size={16} />
            </button>
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-white rotate-45"></div>
            </div>
            
            <div className="flex items-center gap-1">
              {editingName ? (
                <input
                  autoFocus
                  className="text-sm font-semibold text-white bg-black/50 border border-blue-500/50 rounded px-1.5 py-0.5 outline-none"
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  onBlur={handleNameBlur}
                  onKeyDown={e => { if (e.key === 'Enter') handleNameBlur(); if (e.key === 'Escape') setEditingName(false); }}
                />
              ) : (
                <span 
                  className="text-sm font-semibold text-white cursor-text hover:text-blue-400 transition-colors px-1.5 py-0.5"
                  onDoubleClick={() => { setTempName(state.currentProjectName || "Untitled Project"); setEditingName(true); }}
                  title="Double click to rename"
                >
                  {state.currentProjectName || "Untitled Project"} ✎
                </span>
              )}
            </div>

            <div className="flex items-center ml-4 bg-white/5 border border-white/10 rounded overflow-hidden">
               <span className="px-2 py-1 text-[9px] uppercase font-bold text-gray-500 bg-black/20 flex items-center gap-1"><LayoutTemplate size={10}/> Workspace</span>
               <select 
                  value={activeLayout}
                  onChange={e => setActiveLayout(e.target.value as WorkspaceLayout)}
                  className="bg-transparent border-none text-[10px] text-white px-2 py-1 focus:outline-none cursor-pointer hover:bg-white/5 uppercase tracking-widest font-bold font-mono"
               >
                  <option value="editing">Editing</option>
                  <option value="color">Color</option>
                  <option value="audio">Audio</option>
                  <option value="effects">Effects</option>
                  <option value="graphics">Graphics</option>
                  <option value="all">All Panels</option>
               </select>
            </div>
          </div>
          
          <nav className="flex gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            <span title="Edit basic positioning and timeline placement" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "media" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("media")}>Edit</span>
            <span title="Add visual filters and distortion effects" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "effects" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("effects")}>Effects</span>
            <span title="Perform color grading and color correction" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "color" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("color")}>Color</span>
            <span title="Adjust sound levels and audio fading" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "audio" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("audio")}>Audio</span>
            <span title="Motion graphics and text styling" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "graphics" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("graphics")}>Graphics</span>
            <span title="Import, edit, and style subtitles" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "captions" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("captions")}>Captions</span>
            <span title="Optimize and export frames as an Animated PNG" className={cn("cursor-pointer transition-colors", activeTab === "export" ? "text-orange-500" : "text-gray-500 hover:text-orange-400")} onClick={() => setActiveTab("export")}>APNG Route</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-2">
            {state.saveStatus === 'saving' && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">● Saving...</span>}
            {state.saveStatus === 'saved' && <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest text-opacity-100 transition-opacity duration-1000 delay-2000">✓ Saved</span>}
            {state.saveStatus === 'error' && <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">✗ Error</span>}
            {(state.saveStatus === 'idle' || !state.saveStatus) && <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest transition-opacity duration-300 opacity-50 hover:opacity-100 cursor-pointer" title="Ctrl+S" onClick={() => { /* trig save */ }}>● Unsaved</span>}
          </div>

          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">4K @ 60FPS • {formatTime(state.currentTime)}</div>
          <button 
            onClick={() => setShowVideoExportModal(true)}
            title="Open Export Settings to quickly save out your video"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            Export Video
          </button>
          
          <div className="pl-2 border-l border-white/10">
            <UserMenu />
          </div>
        </div>
      </header>
  );
}
