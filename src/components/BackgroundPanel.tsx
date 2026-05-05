import React from 'react';
import { BackgroundConfig, MediaAsset } from '../types';
import { Palette, Image as ImageIcon, Video, Focus, Plus, Trash2, ChevronRight, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  config: BackgroundConfig;
  onChange: (config: BackgroundConfig) => void;
  assets: MediaAsset[];
  onUploadRequest: () => void;
}

export const BackgroundPanel: React.FC<Props> = ({ config, onChange, assets, onUploadRequest }) => {
  const types = [
    { id: 'solid', label: 'Color', icon: <div className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" /> },
    { id: 'gradient', label: 'Gradient', icon: <Palette size={18} /> },
    { id: 'image', label: 'Image', icon: <ImageIcon size={18} /> },
    { id: 'video', label: 'Video', icon: <Video size={18} /> },
    { id: 'blur', label: 'Dynamic', icon: <Focus size={18} /> },
  ];

  const gradientPresets = [
    { from: '#020617', to: '#1e1b4b', label: 'Midnight' },
    { from: '#4338ca', to: '#6366f1', label: 'Indigo' },
    { from: '#be123c', to: '#db2777', label: 'Rose' },
    { from: '#0f172a', to: '#334155', label: 'Slate' },
    { from: '#111827', to: '#1f2937', label: 'Noir' },
    { from: '#064e3b', to: '#059669', label: 'Emerald' },
    { from: '#7c2d12', to: '#450a0a', label: 'Rust' },
    { from: '#1e1b4b', to: '#312e81', label: 'Deep Sea' },
    { from: '#4c1d95', to: '#7c3aed', label: 'Violet' },
    { from: '#0f172a', to: '#334155', label: 'Steel' },
  ];

  const abstractPresets = [
    { color: '#1e1b4b', label: 'Deep Blue' },
    { color: '#450a0a', label: 'Crimson' },
    { color: '#064e3b', label: 'Forest' },
    { color: '#312e81', label: 'Nebula' },
    { color: '#161616', label: 'Glass' },
    { color: '#4338ca', label: 'Royal' },
  ];

  const [search, setSearch] = React.useState('');

  const relevantAssets = (assets || []).filter(a => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (config.type === 'video' || config.type === 'blur') return a.type === 'video' || a.type === 'image';
    if (config.type === 'image') return a.type === 'image';
    return false;
  });

  // Effect to pick default media if none selected
  React.useEffect(() => {
    if ((config.type === 'image' || config.type === 'video' || config.type === 'blur') && !config.mediaUrl && relevantAssets.length > 0) {
      onChange({ ...config, mediaUrl: relevantAssets[0].url });
    }
  }, [config.type, relevantAssets.length, config.mediaUrl]);

  return (
    <div className="flex flex-col gap-6 p-1 h-full overflow-y-auto no-scrollbar pb-20">
      {/* Premium Mode Selector */}
      <div className="grid grid-cols-5 gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/5 shadow-inner">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange({ ...config, type: t.id as any })}
            className={cn(
              "flex flex-col items-center gap-2 p-2.5 rounded-xl transition-all relative overflow-hidden group",
              config.type === t.id 
                ? "bg-blue-600/90 text-white shadow-[0_8px_16px_rgba(37,99,235,0.25)] ring-1 ring-blue-400/50" 
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            )}
          >
            <div className={cn(
              "transition-transform duration-300 group-hover:scale-110",
              config.type === t.id ? "scale-110" : ""
            )}>
              {t.icon}
            </div>
            <span className="text-[7.5px] font-black uppercase tracking-tight leading-none text-center h-3 flex items-center px-0.5">{t.label}</span>
            {config.type === t.id && (
              <motion.div 
                layoutId="bg-glow"
                className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" 
              />
            )}
          </button>
        ))}
      </div>

      <div className="space-y-8 pt-2">
        {/* Colors (Solid Type) */}
        {config.type === 'solid' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
            <div className="flex justify-between items-end px-1">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">Base Tone</label>
                <p className="text-[9px] text-white/20 font-medium">Solid color foundation</p>
              </div>
              <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/5">{config.color}</span>
            </div>
            
            <div className="grid grid-cols-6 gap-3 bg-white/[0.03] p-3 rounded-2xl border border-white/5">
              {['#000000', '#09090b', '#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a', '#FFFFFF', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#ec4899'].map(c => (
                <button 
                  key={c}
                  onClick={() => onChange({ ...config, color: c })}
                  className={cn(
                    "aspect-square rounded-xl border border-white/5 transition-all relative group overflow-hidden",
                    config.color === c ? "ring-2 ring-blue-500 scale-105 shadow-xl shadow-blue-900/30" : "hover:border-white/20 hover:scale-110"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {config.color === c && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
              
              <div className="relative group aspect-square rounded-xl border border-white/10 overflow-hidden hover:border-blue-500/50 transition-colors">
                <input 
                  type="color" 
                  value={config.color || '#000000'} 
                  onChange={(e) => onChange({ ...config, color: e.target.value })}
                  className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-white/40 bg-black/40 backdrop-blur-md group-hover:bg-blue-600/10 group-hover:text-white transition-all">
                  <Plus size={16} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gradients */}
        {config.type === 'gradient' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
            <div className="space-y-4">
              <div className="px-1">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">Master Presets</label>
                <p className="text-[9px] text-white/20 font-medium mt-1">Professional color transitions</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {gradientPresets.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => onChange({ 
                      ...config, 
                      gradient: { from: p.from, to: p.to, angle: config.gradient?.angle ?? 45 } 
                    })}
                    className={cn(
                      "group p-2 rounded-2xl border transition-all text-left flex items-center gap-3 relative overflow-hidden",
                      config.gradient?.from === p.from && config.gradient?.to === p.to 
                        ? "bg-white/10 border-white/20 ring-1 ring-white/10" 
                        : "bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    <div 
                      className="w-12 h-12 rounded-xl border border-white/10 shadow-2xl shrink-0"
                      style={{ background: `linear-gradient(45deg, ${p.from}, ${p.to})` }}
                    />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-[10px] font-bold text-white/80 group-hover:text-white truncate">{p.label}</span>
                      <span className="text-[8px] font-mono text-white/20 truncate">{p.from.toLowerCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5 bg-white/[0.03] p-5 rounded-2xl border border-white/5 relative group">
              <div className="flex gap-6">
                <div className="flex-1 space-y-2.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500" /> Start
                  </label>
                  <div className="relative h-10 rounded-xl overflow-hidden border border-white/10 group/input">
                    <input 
                      type="color" 
                      value={config.gradient?.from || '#000000'}
                      onChange={(e) => onChange({ 
                        ...config, 
                        gradient: { ...config.gradient!, from: e.target.value }
                      })}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white/70 pointer-events-none transition-transform group-hover/input:scale-105"
                      style={{ backgroundColor: config.gradient?.from }}
                    >
                      {config.gradient?.from}
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.15em] flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-indigo-500" /> End
                  </label>
                  <div className="relative h-10 rounded-xl overflow-hidden border border-white/10 group/input">
                    <input 
                      type="color" 
                      value={config.gradient?.to || '#000000'}
                      onChange={(e) => onChange({ 
                        ...config, 
                        gradient: { ...config.gradient!, to: e.target.value }
                      })}
                      className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white/70 pointer-events-none transition-transform group-hover/input:scale-105"
                      style={{ backgroundColor: config.gradient?.to }}
                    >
                      {config.gradient?.to}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">
                  <span className="flex items-center gap-2">Orientation</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded text-white/60">{config.gradient?.angle ?? 45}°</span>
                </div>
                <div className="relative flex items-center group/slider">
                  <input 
                    type="range" min="0" max="360"
                    value={config.gradient?.angle ?? 45}
                    onChange={(e) => onChange({ 
                      ...config, 
                      gradient: { ...config.gradient!, angle: parseInt(e.target.value) } 
                    })}
                    className="w-full h-1.5 bg-black/40 rounded-full accent-blue-500 appearance-none cursor-pointer"
                  />
                  <div className="absolute left-0 h-1.5 bg-blue-500/20 rounded-full pointer-events-none" style={{ width: `${(config.gradient?.angle ?? 45) / 3.6}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Media (Image, Video, Blurred Background) */}
        {(config.type === 'image' || config.type === 'video' || config.type === 'blur') && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out">
            
            {config.type === 'blur' && !config.mediaUrl && (
              <div className="space-y-4 px-1">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">Abstract Presets</label>
                    <p className="text-[9px] text-white/20 font-medium">Select a starting theme</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {abstractPresets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => onChange({ ...config, color: p.color })}
                      className={cn(
                        "p-2 rounded-xl border transition-all text-left flex items-center gap-2 relative overflow-hidden",
                        config.color === p.color ? "bg-white/10 border-white/20" : "bg-black/30 border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[8px] font-bold text-white/60 truncate uppercase tracking-tighter">{p.label}</span>
                    </button>
                  ))}
                </div>
                <div className="h-px bg-white/5 mx-2" />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em]">Media Source</label>
                  <p className="text-[9px] text-white/20 font-medium">Select background layer</p>
                </div>
                <button 
                  onClick={onUploadRequest}
                  className="text-[9px] font-bold text-blue-400/80 hover:text-blue-400 transition-colors uppercase tracking-widest flex items-center gap-1.5 bg-blue-500/5 px-2 py-1 rounded"
                >
                  <Plus size={10} />
                  Import
                </button>
              </div>

              <div className="relative group px-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500">
                  <Search size={10} />
                </div>
                <input 
                  type="text"
                  placeholder="FIND MEDIA..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-[8px] font-bold uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                />
              </div>
              
              <div className="min-h-[100px]">
                {relevantAssets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {relevantAssets.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => onChange({ ...config, mediaUrl: asset.url })}
                        className={cn(
                          "group relative aspect-video rounded-xl border transition-all overflow-hidden bg-black/60 shadow-xl",
                          config.mediaUrl === asset.url ? "border-blue-500 ring-2 ring-blue-500/20" : "border-white/5 hover:border-white/20 hover:scale-[1.02]"
                        )}
                      >
                        {asset.type === 'image' ? (
                          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity" />
                        ) : (
                          <video src={asset.url} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" muted />
                        )}
                        
                        <div className={cn(
                          "absolute inset-0 flex items-center justify-center transition-all",
                          config.mediaUrl === asset.url ? "bg-blue-600/10" : "opacity-0 group-hover:opacity-100 bg-black/40"
                        )}>
                          {config.mediaUrl === asset.url ? (
                             <div className="bg-blue-500 text-white rounded-full p-2 shadow-xl shadow-blue-500/50">
                                <ChevronRight size={14} strokeWidth={3} />
                             </div>
                          ) : (
                             <Plus size={20} className="text-white/80" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div 
                    onClick={onUploadRequest}
                    className="p-8 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02] text-center space-y-3 hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center mx-auto text-white/10 group-hover:text-blue-500 transition-all">
                      <ImageIcon size={20} />
                    </div>
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] leading-relaxed px-4">
                      Add {config.type} files to use this mode
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6 bg-white/[0.03] p-5 rounded-2xl border border-white/5 shadow-inner">
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.15em]">Layout Mode</label>
                    <span className="text-[8px] font-mono text-white/20">Canvas Fitting</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                    {['cover', 'contain', 'stretch'].map(f => (
                      <button
                        key={f}
                        onClick={() => onChange({ ...config, fit: f as any })}
                        className={cn(
                          "py-2.5 text-[8px] font-black uppercase tracking-[0.1em] rounded-lg transition-all",
                          config.fit === f 
                            ? "bg-white/10 text-white shadow-lg" 
                            : "text-gray-500 hover:text-white/60 hover:bg-white/5"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center text-[9px] font-black text-white/30 uppercase tracking-[0.15em]">
                      <span className="flex items-center gap-2">
                        <Focus size={10} className="text-blue-500" />
                        {config.type === 'blur' ? 'Dynamic Flux' : 'Atmospheric Depth'}
                      </span>
                      <span className="bg-white/10 px-2 py-0.5 rounded text-white/60">{Math.round(config.blurIntensity)}%</span>
                    </div>
                    <div className="relative flex items-center group/slider">
                      <input 
                        type="range" min="0" max="100" step="1"
                        value={config.blurIntensity}
                        onChange={(e) => onChange({ ...config, blurIntensity: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-black/40 rounded-full accent-blue-500 appearance-none cursor-pointer"
                      />
                      <div className="absolute left-0 h-1.5 bg-blue-500/20 rounded-full pointer-events-none" style={{ width: `${config.blurIntensity}%` }} />
                    </div>
                    <p className="text-[8px] text-white/10 font-medium px-1 italic">
                      {config.type === 'blur' ? 'Modulate the turbulence and speed of the dynamic flow' : 'Adjust focus depth'}
                    </p>
                </div>
            </div>
          </div>
        )}


        {/* Global Overlay (Finishing Touch) */}
        <div className="space-y-5 pt-8 border-t border-white/10 mt-4 relative">
          <div className="flex justify-between items-center px-1">
             <div className="space-y-1">
                <label className="text-[11px] font-black text-white/60 uppercase tracking-[0.3em]">Ambience</label>
                <p className="text-[8px] text-white/20 font-medium">Global color tinting & mood</p>
             </div>
             {config.overlayOpacity > 0 && (
               <button 
                 onClick={() => onChange({ ...config, overlayOpacity: 0 })}
                 className="text-[8px] font-bold text-red-500/50 uppercase hover:text-red-500 transition-all flex items-center gap-1.5 bg-red-500/5 px-2 py-1 rounded-md"
               >
                 <Trash2 size={10} />
                 Reset
               </button>
             )}
          </div>
          
          <div className="flex items-center gap-5 bg-white/[0.04] p-5 rounded-3xl border border-white/5 group shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />
             
             <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-lg group-hover:ring-2 ring-blue-500/20 transition-all shrink-0">
               <input 
                 type="color" 
                 value={config.overlayColor || '#000000'}
                 onChange={(e) => onChange({ ...config, overlayColor: e.target.value })}
                 className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-20"
               />
               <div className="absolute inset-0 pointer-events-none z-10 transition-transform group-hover:scale-110" style={{ backgroundColor: config.overlayColor }} />
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 pointer-events-none z-15">
                 <Palette size={18} className="text-white ring-offset-2 ring-1 ring-white/20 rounded-full" />
               </div>
             </div>
             
             <div className="flex-1 space-y-4">
               <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase tracking-[0.15em]">
                 <span>Absorption</span>
                 <span className="text-white/70 font-mono">{Math.round((config.overlayOpacity || 0) * 100)}%</span>
               </div>
               <div className="relative flex items-center group/slider">
                 <input 
                   type="range" min="0" max="1" step="0.01"
                   value={config.overlayOpacity || 0}
                   onChange={(e) => onChange({ ...config, overlayOpacity: parseFloat(e.target.value) })}
                   className="w-full h-1.5 bg-black/40 rounded-full accent-blue-500 appearance-none cursor-pointer"
                 />
                 <div className="absolute left-0 h-1.5 bg-blue-500/40 rounded-full pointer-events-none shadow-[0_0_8px_rgba(59,130,246,0.3)]" style={{ width: `${(config.overlayOpacity || 0) * 100}%` }} />
               </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Magic Features */}
      <div className="mt-auto px-1 group">
         <button className="w-full py-4 bg-gradient-to-br from-indigo-500/15 via-blue-500/5 to-transparent border border-indigo-500/20 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all overflow-hidden relative shadow-xl shadow-indigo-500/5 hover:border-indigo-400/40 hover:shadow-indigo-500/10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(99,102,241,0.1),transparent)]" />
            <motion.span 
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="text-indigo-400 text-lg relative z-10"
            >
              ✨
            </motion.span>
            <div className="flex flex-col items-start gap-0.5 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-100">AI Gen Alpha</span>
              <span className="text-[8px] font-medium text-indigo-400/60 uppercase tracking-[0.1em]">Create unique textures</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
         </button>
      </div>
    </div>
  );
};
