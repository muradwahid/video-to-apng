import React from "react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Layers, LayoutTemplate, Palette, ArrowRightLeft, Grid as GridIcon, Search, Video, Image as ImageIcon, Music, MoreVertical, SlidersHorizontal } from "lucide-react";
import { BackgroundPanel } from "@/src/components/BackgroundPanel";
import { FxPanel } from '@/src/components/FxPanel';
import { TemplatePanel } from "@/src/components/TemplatePanel";
import { SequencePanel } from "@/src/components/SequencePanel";
import { AudioMixer } from "@/src/components/AudioMixer";
import { TimelineState, MediaAsset } from "@/src/types";

interface WorkspaceSidebarProps {
  sidebarTab: 'assets' | 'templates' | 'background' | 'transitions' | 'sequence' | 'mixer';
  setSidebarTab: (tab: 'assets' | 'templates' | 'background' | 'transitions' | 'sequence' | 'mixer') => void;
  isAssetDragOver: boolean;
  handleAssetDragOver: (e: React.DragEvent) => void;
  handleAssetDragLeave: (e: React.DragEvent) => void;
  handleAssetDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  assetSearch: string;
  setAssetSearch: (val: string) => void;
  state: TimelineState;
  handleAssetDragStart: (e: React.DragEvent, asset: MediaAsset) => void;
  removeAsset: (id: string) => void;
  pushToHistory: (s: TimelineState) => void;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  handleContextMenu: (e: React.MouseEvent, targetId?: string, type?: 'clip' | 'transition') => void;
  THEME: any;
}

export function WorkspaceSidebar({
  sidebarTab,
  setSidebarTab,
  isAssetDragOver,
  handleAssetDragOver,
  handleAssetDragLeave,
  handleAssetDrop,
  fileInputRef,
  assetSearch,
  setAssetSearch,
  state,
  handleAssetDragStart,
  removeAsset,
  pushToHistory,
  setState,
  handleContextMenu,
  THEME
}: WorkspaceSidebarProps) {
  return (
    <section className="w-64 flex flex-col gap-2" onContextMenu={(e) => handleContextMenu(e)}>
      <div 
        className={cn("rounded-lg border p-3 flex-1 overflow-hidden flex flex-col relative transition-all", isAssetDragOver ? "bg-blue-500/10 border-blue-500" : "")} 
        style={{ backgroundColor: THEME.card, borderColor: isAssetDragOver ? THEME.accent : THEME.border }}
        onDragOver={handleAssetDragOver}
        onDragLeave={handleAssetDragLeave}
        onDrop={handleAssetDrop}
      >
        {isAssetDragOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-blue-900/40 backdrop-blur-sm border-2 border-dashed border-blue-500 rounded-lg">
            <Plus className="w-8 h-8 text-blue-400 mb-2 animate-bounce" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">Drop files here</span>
          </div>
        )}
        
        {/* Sidebar Controls */}
        <div className="flex bg-black/60 p-1 mb-4 rounded-lg border border-white/5 gap-0.5">
          <button 
            onClick={() => setSidebarTab('assets')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'assets' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <Layers size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">Library</span>
          </button>
          <button 
            onClick={() => setSidebarTab('templates')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'templates' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <LayoutTemplate size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">Styles</span>
          </button>
          <button 
            onClick={() => setSidebarTab('background')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'background' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <Palette size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">Design</span>
          </button>
          <button 
            onClick={() => setSidebarTab('transitions')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'transitions' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <ArrowRightLeft size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">FX</span>
          </button>
          <button 
            onClick={() => setSidebarTab('sequence')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'sequence' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <GridIcon size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">Index</span>
          </button>
          <button 
            onClick={() => setSidebarTab('mixer')} 
            className={cn("flex-1 py-2 px-1 rounded flex flex-col items-center gap-1 transition-all", sidebarTab === 'mixer' ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-500 hover:bg-white/5")}
          >
            <SlidersHorizontal size={14} />
            <span className="text-[7px] font-bold uppercase tracking-tighter">Mixer</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {sidebarTab === 'assets' && (
              <motion.div
                key="assets"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col h-full"
              >
                <div className="flex items-center justify-between mb-2 z-10">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Media Assets</h3>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[10px] hover:border-gray-400 hover:text-white transition-colors"
                  >
                    +
                  </button>
                </div>

                <div className="relative mb-3 group">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                    <Search size={10} />
                  </div>
                  <input 
                    type="text"
                    placeholder="FIND ASSETS..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-[8px] font-bold uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pb-4">
                  {(state.assets || []).filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase())).map((asset) => (
                    <div 
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleAssetDragStart(e, asset)}
                      className="group relative aspect-video bg-black/40 rounded-md overflow-hidden border border-white/5 hover:border-blue-500/50 cursor-grab active:cursor-grabbing transition-all"
                    >
                      {asset.type === 'video' ? (
                        <video src={asset.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      ) : asset.type === 'image' ? (
                        <img src={asset.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-900/20 group-hover:bg-emerald-900/40 transition-colors">
                          <Music size={24} className="text-emerald-500/50 group-hover:text-emerald-400 transition-colors" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 translate-y-1 group-hover:translate-y-0 transition-transform">
                        <div className="flex items-center gap-1.5">
                          {asset.type === 'video' ? <Video size={8} className="text-blue-400" /> : asset.type === 'image' ? <ImageIcon size={8} className="text-purple-400" /> : <Music size={8} className="text-emerald-400" />}
                          <span className="text-[8px] font-bold text-gray-300 truncate">{asset.name}</span>
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex">
                         <div className="bg-black/80 rounded p-0.5 border border-white/10 hover:bg-red-500/80 hover:border-red-500 cursor-pointer text-white"
                              onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                         >
                            <Plus className="w-3 h-3 rotate-45" />
                         </div>
                      </div>
                    </div>
                  ))}
                  
                  {(state.assets || []).length === 0 && (
                     <div className="col-span-2 py-8 flex flex-col items-center justify-center text-center opacity-40">
                        <Layers size={24} className="mb-2" />
                        <p className="text-[10px] font-bold tracking-widest uppercase">No assets yet</p>
                        <p className="text-[8px] mt-1 tracking-wider">Drag & drop to import</p>
                     </div>
                  )}
                </div>
              </motion.div>
            )}

            {sidebarTab === 'background' && (
              <motion.div
                key="background"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stage Background</h3>
                </div>
                <BackgroundPanel 
                  config={state.background} 
                  onChange={(config) => setState((prev: any) => ({ ...prev, background: config }))} 
                  assets={state.assets || []} 
                  onUploadRequest={() => fileInputRef.current?.click()} 
                />
              </motion.div>
            )}

            {sidebarTab === 'transitions' && (
              <motion.div
                key="transitions"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="h-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Effects & Transitions</h3>
                </div>
                <FxPanel  state={state} setState={setState} pushToHistory={pushToHistory} />
              </motion.div>
            )}

            {sidebarTab === 'templates' && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Smart Themes</h3>
                </div>
                <TemplatePanel setState={setState} pushToHistory={pushToHistory} />
              </motion.div>
            )}

            {sidebarTab === 'sequence' && (
               <motion.div
                 key="sequence"
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -10 }}
               >
                 <SequencePanel state={state} onSelectClip={(id) => setState(prev => ({...prev, selectedClipId: id, selectedClipIds: [id]}))} />
               </motion.div>
            )}

            {sidebarTab === 'mixer' && (
               <motion.div
                 key="mixer"
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -10 }}
               >
                 <div className="flex items-center justify-between mb-4 mt-2 px-2">
                   <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Audio Track Mixer</h3>
                 </div>
                 <div className="h-64">
                    <AudioMixer state={state} setState={setState} />
                 </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
