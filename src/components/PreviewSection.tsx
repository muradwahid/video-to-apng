import React, { useState, useRef } from "react";
import { cn, formatTime } from "@/src/lib/utils";
import { SkipBack, Play, Pause, SkipForward, Crop as CropIcon } from "lucide-react";
import { VideoCanvas } from "@/src/components/VideoCanvas";
import { CropTool } from "@/src/components/CropTool";
import { TimelineState, VideoClip } from "@/src/types";

import { VideoScopes } from './VideoScopes';

interface PreviewSectionProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  showCropTool: boolean;
  setShowCropTool: (show: boolean) => void;
  handleApplyCrop: (crop: { x: number, y: number, width: number, height: number }) => void;
  activeTab?: string;
  theme: any;
}

export function PreviewSection({
  state,
  setState,
  showCropTool,
  setShowCropTool,
  handleApplyCrop,
  activeTab,
  theme
}: PreviewSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTab === 'graphics' && containerRef.current && !state.selectedClipId) {
      // Create new text layer at click pos
      const rect = containerRef.current.getBoundingClientRect();
      // calculate position relative to center of the canvas (-width/2 to +width/2 scale)
      // canvas virtual width is 1920x1080
      const xPercent = (e.clientX - rect.left) / rect.width;
      const yPercent = (e.clientY - rect.top) / rect.height;
      const virtualX = (xPercent - 0.5) * 1920;
      const virtualY = (yPercent - 0.5) * 1080;

      const newClip: VideoClip = {
        id: crypto.randomUUID(),
        name: 'New Text',
        url: '',
        type: 'text',
        duration: 5,
        startTime: state.currentTime,
        sourceStart: 0,
        sourceEnd: 5,
        volume: 1,
        speed: 1,
        trackIndex: 3,
        locked: false,
        transform: { scale: 1, x: virtualX, y: virtualY, rotation: 0, opacity: 1 },
        text: {
           content: 'New Text',
           fontFamily: 'Inter',
           fontSize: 64,
           color: '#ffffff',
           align: 'center',
           bold: true,
           italic: false,
        }
      };

      setState(prev => ({ ...prev, clips: [...prev.clips, newClip], selectedClipId: newClip.id, selectedClipIds: [newClip.id] }));
    } else if (activeTab === 'graphics' || activeTab === 'captions') {
       // do nothing
    } else {
       // clear selection
       setState(prev => ({ ...prev, selectedClipId: null, selectedClipIds: [] }));
    }
  };

  const handleDragParams = (clipId: string, dx: number, dy: number) => {
     setState(prev => ({
        ...prev,
        clips: prev.clips.map(c => {
           if (c.id === clipId) {
              return {
                 ...c,
                 transform: {
                    ...c.transform,
                    x: (c.transform.x || 0) + dx,
                    y: (c.transform.y || 0) + dy
                 }
              }
           }
           return c;
        })
     }));
  };

  return (
    <section className="flex-1 flex flex-col gap-2">
      <div className="flex-1 bg-black rounded-lg border relative overflow-hidden flex items-center justify-center" style={{ borderColor: theme.borderStrong }}>
        {/* Meta Info */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Preview Node v0.8</span>
        </div>

        {/* Video Preview Canvas */}
        <div className="w-full h-full bg-gradient-to-br from-indigo-900/10 to-black flex items-center justify-center relative">
          <div className="w-[85%] aspect-video relative" ref={containerRef} onClick={handleCanvasClick}>
            <VideoCanvas 
              clips={state.clips.map(clip => {
                 if (state.useProxies !== false) {
                    const asset = (state.assets || []).find(a => a.url === clip.url);
                    if (asset && asset.proxyStatus === 'ready' && asset.proxyUrl) {
                       return { ...clip, url: asset.proxyUrl };
                    }
                 }
                 return clip;
              })} 
              currentTime={state.currentTime} 
              width={1920} 
              height={1080} 
              isCropping={showCropTool}
              background={state.background}
              transitions={state.transitions}
            />
            
            {/* SVG OVERLAY for Dragging Text/Graphics */}
            {(activeTab === 'graphics' || activeTab === 'captions') && (
               <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
                  {(state.clips || []).filter(c => c.type === 'text' || c.type === 'caption' || c.type === 'graphic')
                      .filter(c => state.currentTime >= c.startTime && state.currentTime < c.startTime + c.duration)
                      .map(clip => {
                         const X = ((clip.transform.x || 0) / 1920 + 0.5) * 100;
                         const Y = ((clip.transform.y || 0) / 1080 + 0.5) * 100;
                         const isSelected = state.selectedClipId === clip.id;
                         
                         return (
                            <div 
                               key={clip.id} 
                               className={`absolute pointer-events-auto cursor-move transition-colors outline outline-2 outline-transparent hover:outline-blue-500/50 ${isSelected ? '!outline-blue-500 bg-blue-500/10' : ''}`}
                               style={{ left: `${X}%`, top: `${Y}%`, transform: 'translate(-50%, -50%)', padding: '10px' }}
                               onClick={(e) => { e.stopPropagation(); setState(prev => ({...prev, selectedClipId: clip.id, selectedClipIds: [clip.id]})); }}
                               onDragStart={(e) => {
                                  e.dataTransfer.setDragImage(new Image(), 0, 0);
                                  e.dataTransfer.setData('text/plain', clip.id);
                               }}
                               onDrag={(e) => {
                                  if (e.clientX === 0 && e.clientY === 0) return;
                                  // We do simple pos update
                               }}
                               onDragEnd={(e) => {
                                  const rect = containerRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  const xPercent = (e.clientX - rect.left) / rect.width;
                                  const yPercent = (e.clientY - rect.top) / rect.height;
                                  const virtualX = (xPercent - 0.5) * 1920;
                                  const virtualY = (yPercent - 0.5) * 1080;
                                  setState(p => ({
                                     ...p,
                                     clips: p.clips.map(c => c.id === clip.id ? {...c, transform: {...c.transform, x: virtualX, y: virtualY}} : c)
                                  }));
                               }}
                               draggable
                            >
                               <div className="w-4 h-4 rounded-full border border-blue-500 bg-blue-500/20 absolute -top-2 -left-2 opacity-0 group-hover:opacity-100" />
                               <div className="w-full h-full min-w-[50px] min-h-[20px]" />
                            </div>
                         )
                      })
                  }
               </div>
            )}

            {showCropTool && (
              <CropTool 
                onCropChange={() => {}} 
                onApply={handleApplyCrop}
                onCancel={() => setShowCropTool(false)}
                initialCrop={(() => {
                  const c = (state.clips || []).find(clip => clip.id === state.selectedClipId);
                  if (!c || !c.transform.crop) return undefined;
                  const S = c.transform.scale || 1;
                  const centerX = (c.transform.x || 0) / 1920;
                  const centerY = (c.transform.y || 0) / 1080;
                  return {
                    x: 0.5 + (c.transform.crop.x - 0.5) * S + centerX,
                    y: 0.5 + (c.transform.crop.y - 0.5) * S + centerY,
                    width: c.transform.crop.width * S,
                    height: c.transform.crop.height * S,
                  };
                })()}
              />
            )}
            {activeTab === 'color' && <VideoScopes layout={4} />}
          </div>
        </div>

        {/* Preview Controls Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-6 py-2 rounded-full border border-white/10 flex items-center gap-8 shadow-2xl">
          <span className="text-xs font-mono tabular-nums tracking-tighter text-blue-400" title="Current Playhead Time">{formatTime(state.currentTime)}</span>
          <div className="flex items-center gap-6">
            <button title="Step backward 1 frame" className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.max(0, s.currentTime - 1/30)}))}><SkipBack className="h-4 w-4" /></button>
            <button 
              onClick={() => {
                const hasContent = (state.clips || []).length > 0 || state.background.type !== 'solid' || state.background.color !== '#000000';
                if (hasContent) {
                  setState(s => ({ ...s, isPlaying: !s.isPlaying }));
                }
              }}
              disabled={!((state.clips || []).length > 0 || state.background.type !== 'solid' || state.background.color !== '#000000')}
              title={!((state.clips || []).length > 0 || state.background.type !== 'solid' || state.background.color !== '#000000') ? "Add clips or background to play" : (state.isPlaying ? "Pause (Space)" : "Play (Space)")}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-90 hover:scale-110",
                !((state.clips || []).length > 0 || state.background.type !== 'solid' || state.background.color !== '#000000') && "opacity-50 cursor-not-allowed scale-100 hover:scale-100"
              )}
            >
              {state.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
            </button>
            <button title="Step forward 1 frame" className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.min(s.duration, s.currentTime + 1/30)}))}><SkipForward className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2 mr-4">
            <select 
              className="bg-transparent border border-white/20 text-white text-xs rounded px-1 py-0.5 outline-none hover:border-white/40"
              value={state.playbackSpeed}
              onChange={(e) => setState(s => ({...s, playbackSpeed: parseFloat(e.target.value)}))}
              title="Playback Speed"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button title="Toggle Crop Mode for selected clip" className={cn("opacity-40 hover:opacity-100 transition-opacity", showCropTool && "opacity-100 text-blue-500")} onClick={() => setShowCropTool(!showCropTool)}><CropIcon className="h-4 w-4" /></button>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest pl-2 border-l border-white/10" title="Preview Resolution Quality">1/4 Res</span>
          </div>
        </div>
      </div>
    </section>
  );
}
