import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, ListVideo, X, Settings2, Settings, Play, Image as ImageIcon, Music, Check, Loader2, Save, Video } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { TimelineState } from "@/src/types";
import { useExportStore } from "@/src/store/exportStore";
import { processExportJob } from "@/src/lib/ffmpegExport";

interface VideoExportModalProps {
  showVideoExportModal: boolean;
  setShowVideoExportModal: (show: boolean) => void;
  videoExportConfig: { quality: string; fps: number; format: string };
  setVideoExportConfig: React.Dispatch<React.SetStateAction<{ quality: string; fps: number; format: string }>>;
  handleExportVideo: () => void;
  state: TimelineState;
}

const BUILT_IN_PRESETS = [
  { id: 'yt-4k', name: 'YouTube 4K', config: { width: 3840, height: 2160, fps: 60, codec: 'h264', container: 'mp4', bitrate: 'high' } },
  { id: 'yt-1080p', name: 'YouTube 1080p', config: { width: 1920, height: 1080, fps: 60, codec: 'h264', container: 'mp4', bitrate: 'medium' } },
  { id: 'ig-reel', name: 'Instagram Reel (9:16)', config: { width: 1080, height: 1920, fps: 30, codec: 'h264', container: 'mp4', bitrate: 'medium' } },
  { id: 'tiktok', name: 'TikTok', config: { width: 1080, height: 1920, fps: 30, codec: 'h264', container: 'mp4', bitrate: 'medium' } },
  { id: 'twitter', name: 'Twitter/X', config: { width: 1280, height: 720, fps: 30, codec: 'h264', container: 'mp4', bitrate: 'low' } },
];

export function VideoExportModal({
  showVideoExportModal,
  setShowVideoExportModal,
  state
}: VideoExportModalProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'queue'>('settings');
  const exportQueue = useExportStore(s => s.queue);
  const addJob = useExportStore(s => s.addJob);
  const clearDone = useExportStore(s => s.clearDone);

  const [selectedPreset, setSelectedPreset] = useState('yt-1080p');
  const [config, setConfig] = useState({
     width: 1920, height: 1080, fps: 60,
     codec: 'h264', container: 'mp4',
     audioCodec: 'aac',
     title: 'My Video', author: '', description: '',
     c2paEnabled: false, c2paCreator: '', c2paSocials: '', c2paGenAI: false
  });

  useEffect(() => {
     if (Notification.permission === 'default') {
        try {
           const promise = Notification.requestPermission();
           if (promise && promise.catch) {
              promise.catch(err => console.warn('Notification permission error', err));
           }
        } catch (err) {
           console.warn('Sync Notification permission error', err);
        }
     }
  }, []);

  const handleApplyPreset = (id: string) => {
     setSelectedPreset(id);
     const preset = BUILT_IN_PRESETS.find(p => p.id === id);
     if (preset) setConfig(prev => ({ ...prev, ...preset.config }));
  };

  const handleQueueExport = () => {
     const jobId = crypto.randomUUID();
     addJob({
        id: jobId,
        name: config.title || 'Untitled Export',
        preset: BUILT_IN_PRESETS.find(p => p.id === selectedPreset)?.name || 'Custom',
        progress: 0,
        status: 'queued',
        estimatedTimeRemaining: 'Calculating...',
        timelineState: state,
        config: config
     });
     processExportJob(jobId);
     setActiveTab('queue');
  };

  return (
    <AnimatePresence>
      {showVideoExportModal && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowVideoExportModal(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-[#0A0A0A]">
              <div className="flex items-center gap-6">
                 <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-500" /> Export Media
                 </h2>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('settings')}
                      className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors", activeTab === 'settings' ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
                    >Settings</button>
                    <button 
                      onClick={() => setActiveTab('queue')}
                      className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2", activeTab === 'queue' ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
                    >
                      Queue {exportQueue.length > 0 && <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[9px]">{exportQueue.length}</span>}
                    </button>
                 </div>
              </div>
              <button onClick={() => setShowVideoExportModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar p-6">
              {activeTab === 'settings' ? (
                 <div className="grid grid-cols-12 gap-8">
                    {/* Left Col: Presets & General */}
                    <div className="col-span-4 space-y-6">
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Format & Preset</label>
                         <select 
                           value={selectedPreset} 
                           onChange={(e) => handleApplyPreset(e.target.value)}
                           className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                         >
                           <optgroup label="Web & Social">
                             {BUILT_IN_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </optgroup>
                           <option value="custom">Custom</option>
                         </select>
                       </div>

                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Output Name</label>
                         <input 
                           type="text" 
                           value={config.title}
                           onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                           className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                         />
                       </div>
                       
                       <div className="space-y-2">
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Container Format</label>
                         <div className="flex gap-2">
                            {['mp4', 'mov', 'webm'].map(f => (
                               <button 
                                 key={f}
                                 onClick={() => setConfig(prev => ({ ...prev, container: f, codec: f === 'webm' ? 'vp9' : 'h264' }))}
                                 className={cn("flex-1 py-1.5 text-xs font-bold uppercase rounded border", config.container === f ? "bg-blue-600/20 text-blue-400 border-blue-500/50" : "bg-[#1A1A1A] text-gray-500 border-white/10")}
                               >
                                  .{f}
                               </button>
                            ))}
                         </div>
                       </div>
                    </div>

                    {/* Right Col: Advanced Settings */}
                    <div className="col-span-8 grid grid-cols-2 gap-6 p-4 rounded-xl border border-white/5 bg-[#0A0A0A]">
                      <div className="space-y-4">
                         <div className="pb-2 border-b border-white/5"><h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><Video size={14}/> Video</h3></div>
                         
                         <div className="space-y-2">
                           <label className="text-[10px] font-medium text-gray-400 uppercase">Video Codec</label>
                           <select value={config.codec} onChange={(e) => setConfig(prev => ({ ...prev, codec: e.target.value }))} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                             {config.container !== 'webm' && <option value="h264">H.264</option>}
                             {config.container !== 'webm' && <option value="h265">HEVC (H.265)</option>}
                             {config.container === 'webm' && <option value="vp9">VP9</option>}
                           </select>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-2">
                           <div className="space-y-1">
                             <label className="text-[10px] font-medium text-gray-400 uppercase">Width</label>
                             <input type="number" value={config.width} onChange={(e) => setConfig({ ...config, width: parseInt(e.target.value)||0 })} className="w-full bg-[#1A1A1A] border-white/10 rounded py-1.5 px-2 text-xs text-white"/>
                           </div>
                           <div className="space-y-1">
                             <label className="text-[10px] font-medium text-gray-400 uppercase">Height</label>
                             <input type="number" value={config.height} onChange={(e) => setConfig({ ...config, height: parseInt(e.target.value)||0 })} className="w-full bg-[#1A1A1A] border-white/10 rounded py-1.5 px-2 text-xs text-white"/>
                           </div>
                         </div>
                         
                         <div className="space-y-2">
                           <label className="text-[10px] font-medium text-gray-400 uppercase">Frame Rate</label>
                           <select value={config.fps} onChange={(e) => setConfig(prev => ({ ...prev, fps: parseFloat(e.target.value) }))} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                             <option value={23.976}>23.976 fps</option>
                             <option value={24}>24 fps</option>
                             <option value={25}>25 fps</option>
                             <option value={29.97}>29.97 fps</option>
                             <option value={30}>30 fps</option>
                             <option value={60}>60 fps</option>
                           </select>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="pb-2 border-b border-white/5"><h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><Music size={14}/> Audio & Meta</h3></div>
                         
                         <div className="space-y-2">
                           <label className="text-[10px] font-medium text-gray-400 uppercase">Audio Codec</label>
                           <select value={config.audioCodec} onChange={(e) => setConfig(prev => ({ ...prev, audioCodec: e.target.value }))} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                             <option value="aac">AAC</option>
                             <option value="mp3">MP3</option>
                           </select>
                         </div>

                         <div className="space-y-2 pt-2">
                           <label className="text-[10px] font-medium text-gray-400 uppercase">Author Tags (XMP)</label>
                           <input type="text" placeholder="Creator Name" value={config.author} onChange={(e) => setConfig({ ...config, author: e.target.value })} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white"/>
                         </div>

                         <div className="pt-4 border-t border-white/5 space-y-4">
                           <div className="flex items-center justify-between">
                             <label className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">Content Credentials (C2PA)</label>
                             <input type="checkbox" checked={config.c2paEnabled} onChange={e => setConfig({...config, c2paEnabled: e.target.checked})} />
                           </div>
                           {config.c2paEnabled && (
                             <div className="space-y-2 pl-2 border-l-2 border-blue-600">
                               <input type="text" placeholder="Creator Name" value={config.c2paCreator} onChange={e => setConfig({...config, c2paCreator: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white"/>
                               <input type="text" placeholder="Linked Social Accounts (comma separated)" value={config.c2paSocials} onChange={e => setConfig({...config, c2paSocials: e.target.value})} className="w-full bg-[#1A1A1A] border border-white/10 rounded px-2 py-1.5 text-xs text-white"/>
                               <label className="flex items-center gap-2 text-[10px] text-gray-400 uppercase"><input type="checkbox" checked={config.c2paGenAI} onChange={e => setConfig({...config, c2paGenAI: e.target.checked})}/> Generative AI Used</label>
                             </div>
                           )}
                         </div>

                         <div className="pt-4 border-t border-white/5 space-y-2">
                           <button onClick={() => {
                              const canvas = document.querySelector('canvas');
                              if (canvas) {
                                 const a = document.createElement('a');
                                 a.href = canvas.toDataURL('image/png');
                                 a.download = 'poster_frame.png';
                                 a.click();
                              }
                           }} className="w-full flex items-center justify-center gap-2 py-2 bg-[#1A1A1A] hover:bg-white/5 rounded border border-white/10 text-xs text-gray-300 font-medium transition-colors">
                              <ImageIcon size={12}/> Export Poster Frame
                           </button>
                           <button onClick={() => {
                              const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">\n   <resources>\n      <format id="r1" name="FFVideoFormat1080p60" frameDuration="1/60s" width="1920" height="1080"/>\n   </resources>\n   <library>\n      <event name="Exported Event">\n         <project name="Exported Project">\n            <sequence format="r1" duration="${state.duration}s">\n               <spine>\n                  ${(state.clips || []).map(c => `<clip name="${c.name || 'Clip'}" offset="${c.startTime}s" duration="${c.duration}s" start="${c.sourceStart}s" />`).join('\n                  ')}\n               </spine>\n            </sequence>\n         </project>\n      </event>\n   </library>\n</fcpxml>`;
                              const blob = new Blob([xml], { type: 'application/xml' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'sequence.fcpxml';
                              a.click();
                           }} className="w-full flex items-center justify-center gap-2 py-2 bg-[#1A1A1A] hover:bg-white/5 rounded border border-white/10 text-xs text-gray-300 font-medium transition-colors">
                              <ListVideo size={12}/> Export FCP XML
                           </button>
                           <button onClick={() => {
                              const otio = { 
                                 "OTIO_SCHEMA": "Timeline.1", "name": "Exported Timeline",
                                 "tracks": { "OTIO_SCHEMA": "Stack.1", "children": [
                                    { "OTIO_SCHEMA": "Track.1", "kind": "Video", "children": (state.clips || []).map(c => ({
                                       "OTIO_SCHEMA": "Clip.1", "name": c.name || "Clip", "source_range": {
                                          "OTIO_SCHEMA": "TimeRange.1", "start_time": { "OTIO_SCHEMA": "RationalTime.1", "value": c.sourceStart * 24, "rate": 24 },
                                          "duration": { "OTIO_SCHEMA": "RationalTime.1", "value": c.duration * 24, "rate": 24 }
                                       }
                                    }))}
                                 ]}
                              };
                              const blob = new Blob([JSON.stringify(otio, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'sequence.otio';
                              a.click();
                           }} className="w-full flex items-center justify-center gap-2 py-2 bg-[#1A1A1A] hover:bg-white/5 rounded border border-white/10 text-xs text-gray-300 font-medium transition-colors">
                              <ListVideo size={12}/> Export OTIO
                           </button>
                         </div>
                      </div>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-4">
                    {exportQueue.length === 0 ? (
                       <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                          <ListVideo className="w-16 h-16 mb-4 opacity-50" />
                          <h3 className="text-xs font-bold uppercase tracking-widest">Queue is Empty</h3>
                          <p className="text-[10px] mt-2">Export tasks will appear here and process in the background.</p>
                       </div>
                    ) : (
                       <div className="space-y-3">
                          <div className="flex justify-end">
                             <button onClick={clearDone} className="text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors tracking-widest">Clear Finished</button>
                          </div>
                          {exportQueue.map(job => (
                             <div key={job.id} className="p-4 bg-[#0A0A0A] border border-white/10 rounded-xl flex items-center gap-4">
                                <div className="p-3 bg-white/5 rounded-lg text-blue-500">
                                   {job.status === 'done' ? <Check size={20} className="text-green-500" /> : job.status === 'error' ? <X size={20} className="text-red-500" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                                </div>
                                <div className="flex-1 space-y-2">
                                   <div className="flex justify-between items-end">
                                      <div>
                                         <h4 className="text-xs font-bold text-white">{job.name}</h4>
                                         <p className="text-[10px] text-gray-500 uppercase tracking-widest">{job.preset} • {job.status}</p>
                                      </div>
                                      {job.status === 'encoding' && (
                                         <span className="text-xs font-mono text-blue-400">{Math.round(job.progress * 100)}%</span>
                                      )}
                                   </div>
                                   {job.status === 'encoding' && (
                                     <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                       <div className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${job.progress * 100}%` }} />
                                     </div>
                                   )}
                                   {job.status === 'done' && job.blobUrl && (
                                     <div className="pt-2">
                                        <a href={job.blobUrl} download={job.name} className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-colors">
                                           <Download size={12} /> Download
                                        </a>
                                     </div>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </div>
              )}
            </div>

            {/* Footer */}
            {activeTab === 'settings' && (
               <div className="shrink-0 p-4 border-t border-white/10 bg-[#0A0A0A] flex justify-between items-center">
                 <button className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hidden hover:text-white transition-colors items-center gap-1">
                    <Save size={12} /> Save Preset
                 </button>
                 <div className="flex-1" />
                 <button 
                   onClick={handleQueueExport}
                   disabled={state.clips.length === 0}
                   className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold uppercase tracking-widest text-white shadow-lg flex items-center gap-2 transition-all active:scale-95"
                 >
                    <Download size={14} /> Send to Media Encoder
                 </button>
               </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

