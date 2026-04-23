import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Scissors as Scissor, Combine, 
  Crop as CropIcon, Layers, Download, Plus, Video, Music,
  Settings, History, Maximize2, Trash2, Sliders, Image as ImageIcon,
  Monitor, Info, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatTime } from "@/src/lib/utils";
import { VideoClip, TimelineState, APNGOptions, MediaAsset } from "@/src/types";
import { VideoCanvas } from "@/src/components/VideoCanvas";
import { CropTool } from "@/src/components/CropTool";
import { APNGConverter } from "@/src/components/APNGConverter";
import { PropertyInspector } from "@/src/components/PropertyInspector";
import { Filmstrip } from "@/src/components/Filmstrip";
import UPNG from "upng-js";
import pako from "pako";

// @ts-ignore
window.pako = pako;

// Design constants from Bento Grid Theme
const THEME = {
  bg: "#0A0A0A",
  card: "#161616",
  timeline: "#121212",
  sidebar: "#161616",
  accent: "#2563EB", // Blue-600
  accentOrange: "#EA580C", // Orange-600
  border: "rgba(255, 255, 255, 0.05)",
  borderStrong: "rgba(255, 255, 255, 0.1)",
  text: "#D1D5DB", // Gray-300
  textMuted: "#6B7280", // Gray-500
  textHeader: "#9CA3AF" // Gray-400
};

export default function App() {
  const [state, setState] = useState<TimelineState>({
    clips: [],
    assets: [],
    currentTime: 0,
    duration: 30, // Default 30s timeline
    isPlaying: false,
    selectedClipId: null,
    zoomLevel: 100 // pixels per second
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"media" | "effects" | "color" | "audio" | "export">("media");
  const [showCropTool, setShowCropTool] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);

  const [history, setHistory] = useState<{ undo: any[], redo: any[] }>({ undo: [], redo: [] });

  const pushToHistory = useCallback((currentState: any) => {
    setHistory(prev => ({
      undo: [JSON.parse(JSON.stringify(currentState)), ...prev.undo].slice(0, 50),
      redo: []
    }));
  }, []);

  const undo = () => {
    if (history.undo.length === 0) return;
    const [lastState, ...remainingUndo] = history.undo;
    setHistory(prev => ({ undo: remainingUndo, redo: [JSON.parse(JSON.stringify(state)), ...prev.redo] }));
    setState(lastState);
  };

  const redo = () => {
    if (history.redo.length === 0) return;
    const [nextState, ...remainingRedo] = history.redo;
    setHistory(prev => ({ undo: [JSON.parse(JSON.stringify(state)), ...prev.undo], redo: remainingRedo }));
    setState(nextState);
  };

  const updateClipPosition = useCallback((id: string, newStartTime: number) => {
    setState(prev => {
      let t = Math.max(0, newStartTime);
      
      if (snapEnabled) {
        const snapPoints = [
          prev.currentTime,
          ...prev.clips.filter(c => c.id !== id).map(c => c.startTime),
          ...prev.clips.filter(c => c.id !== id).map(c => c.startTime + c.duration)
        ];
        const snap = snapPoints.find(p => Math.abs(p - t) < 0.1);
        if (snap !== undefined) t = snap;
      }

      return {
        ...prev,
        clips: prev.clips.map(c => c.id === id ? { ...c, startTime: t } : c)
      };
    });
  }, [snapEnabled]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => prev ? { ...prev, show: false } : null);
  }, []);

  const handleSplit = useCallback((targetId?: string) => {
    setState(prev => {
      const idToSplit = targetId || prev.selectedClipId;
      if (!idToSplit) return prev;
      
      const clip = prev.clips.find(c => c.id === idToSplit);
      if (!clip) return prev;

      // Check if current time is within clip
      if (prev.currentTime <= clip.startTime || prev.currentTime >= clip.startTime + clip.duration) {
        alert("Playhead must be inside the clip to split.");
        return prev;
      }

      const splitOffset = prev.currentTime - clip.startTime;
      
      if (splitOffset < 0.1 || (clip.duration - splitOffset) < 0.1) {
        alert("Cannot split too close to the start or end of a clip.");
        return prev;
      }

      // Push history
      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      const clipA: VideoClip = {
        ...clip,
        duration: splitOffset,
        sourceEnd: clip.sourceStart + splitOffset
      };

      const clipB: VideoClip = {
        ...clip,
        id: Math.random().toString(36).substr(2, 9),
        startTime: prev.currentTime,
        duration: clip.duration - splitOffset,
        sourceStart: clip.sourceStart + splitOffset
      };

      return {
        ...prev,
        clips: [...prev.clips.filter(c => c.id !== clip.id), clipA, clipB],
        selectedClipId: clipB.id
      };
    });
    closeContextMenu();
  }, [closeContextMenu]);

  const removeClip = useCallback((id?: string) => {
    setState(prev => {
      const idToRemove = id || prev.selectedClipId;
      if (!idToRemove) return prev;

      // Push history with the state BEFORE filtering
      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      return {
        ...prev,
        clips: prev.clips.filter(c => c.id !== idToRemove),
        selectedClipId: prev.selectedClipId === idToRemove ? null : prev.selectedClipId
      };
    });
    closeContextMenu();
  }, [closeContextMenu]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          setState(s => ({ ...s, isPlaying: !s.isPlaying }));
          break;
        case "s":
          handleSplit();
          break;
        case "delete":
        case "backspace":
          if (state.selectedClipId) {
            removeClip(state.selectedClipId);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedClipId, state.currentTime, handleSplit, removeClip]);

  // Sync dynamic duration based on clips
  useEffect(() => {
    setState(prev => {
      const contentEnd = prev.clips.length > 0 
        ? Math.max(...prev.clips.map(c => c.startTime + c.duration)) 
        : 30;
      
      // We want the duration to be at least the contentEnd, 
      // but also provide a bit of room for interaction.
      const newDuration = Math.max(30, contentEnd);
      
      if (prev.duration !== newDuration) {
        return { ...prev, duration: newDuration };
      }
      return prev;
    });
  }, [state.clips]);

  // Playback Loop
  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== undefined && state.isPlaying) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      setState(prev => {
        const nextTime = prev.currentTime + deltaTime;
        const contentEnd = prev.clips.length > 0 
          ? Math.max(...prev.clips.map(c => c.startTime + c.duration)) 
          : prev.duration;

        if (nextTime >= contentEnd) {
          return { ...prev, currentTime: contentEnd, isPlaying: false };
        }
        return { ...prev, currentTime: nextTime };
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [state.isPlaying]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleConvert = async (options: APNGOptions) => {
    if (state.clips.length === 0) {
      alert("No clips to export!");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setState(s => ({ ...s, isPlaying: false })); // Stop playback

    try {
      const fps = options.fps || 24;
      const scale = options.scale || 0.5;
      const width = 1920 * scale;
      const height = 1080 * scale;

      // Calculate exact content boundaries to remove leading/trailing gaps
      const minStartTime = Math.min(...state.clips.map(c => c.startTime));
      const maxEndTime = Math.max(...state.clips.map(c => c.startTime + c.duration));
      const exportDuration = maxEndTime - minStartTime;
      
      const totalFrames = Math.floor(exportDuration * fps);
      if (totalFrames <= 0) {
        alert("Video too short for the current FPS settings.");
        return;
      }
      
      const frames: ArrayBuffer[] = [];
      const delays: number[] = [];
      
      // Precision delta timing relative to the export duration
      for (let i = 0; i < totalFrames; i++) {
        const timestampMs = Math.round((i + 1) * 1000 / fps);
        const prevTimestampMs = Math.round(i * 1000 / fps);
        delays.push(timestampMs - prevTimestampMs);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error("Could not initialize canvas context");

      // Setup temp media for all unique URLs
      const urls = Array.from(new Set(state.clips.map(c => c.url)));
      const mediaElements: { [url: string]: HTMLVideoElement | HTMLImageElement } = {};
      
      await Promise.all(urls.map(url => {
        const clip = state.clips.find(c => c.url === url);
        return new Promise((resolve, reject) => {
          if (clip?.type === 'video') {
            const v = document.createElement('video');
            v.src = url;
            v.muted = true;
            v.preload = "auto";
            v.crossOrigin = "anonymous";
            v.onloadedmetadata = () => resolve(v);
            v.onerror = reject;
            mediaElements[url] = v;
          } else {
            const img = new Image();
            img.src = url;
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            mediaElements[url] = img;
          }
        });
      }));

      for (let i = 0; i < totalFrames; i++) {
        const time = minStartTime + (i / fps);
        
        // Solid black background prevents "transparency blinks" at loop points or between clips
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        // Calculate exact content boundaries relative to minStartTime
        const absoluteTime = minStartTime + (i / fps);
        const activeClips = state.clips.filter(c => absoluteTime >= c.startTime && absoluteTime < c.startTime + c.duration);
        
        for (const clip of activeClips) {
          ctx.save();

          // Setup Transform for Export
          ctx.translate(width / 2, height / 2);
          ctx.rotate((clip.transform.rotation || 0) * Math.PI / 180);
          ctx.scale(clip.transform.scale || 1, clip.transform.scale || 1);
          ctx.translate(-width / 2, -height / 2);

          const media = mediaElements[clip.url];
          
          // Apply Filters to exported frame
          if (clip.filters) {
            const f = clip.filters;
            ctx.filter = `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturation}) blur(${f.blur}px) grayscale(${f.grayscale}) sepia(${f.sepia}) invert(${f.invert})`;
          } else {
            ctx.filter = 'none';
          }

          if (clip.type === 'video' && media instanceof HTMLVideoElement) {
            const relativeTime = (time - clip.startTime) * clip.speed + clip.sourceStart;
            media.currentTime = relativeTime;
            
            // Wait for seek to complete
            await new Promise(resolve => {
              const onSeeked = () => {
                media.removeEventListener('seeked', onSeeked);
                resolve(null);
              };
              media.addEventListener('seeked', onSeeked);
            });

            if (clip.transform.crop) {
              const { x, y, width: cw, height: ch } = clip.transform.crop;
              ctx.drawImage(
                media,
                x * media.videoWidth, y * media.videoHeight, cw * media.videoWidth, ch * media.videoHeight,
                0, 0, width, height
              );
            } else {
              ctx.drawImage(media, 0, 0, width, height);
            }

            // Apply Post-processing effects to export (Vignette & Grain)
            if (clip.filters) {
              const f = clip.filters;
              
              // Vignette
              if (f.vignette > 0) {
                const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.8);
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
              }

              // Grain
              if (f.grain > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                for (let j = 0; j < 500 * f.grain; j++) {
                  ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
                }
              }
            }
          } else if (clip.type === 'image' && media instanceof HTMLImageElement) {
            ctx.drawImage(media, 0, 0, width, height);
          }
          ctx.restore();
        }

        const imageData = ctx.getImageData(0, 0, width, height).data;
        frames.push(imageData.buffer);
        setProgress((i + 1) / totalFrames);
      }

      // Encode to APNG with specified loop count (0 = infinite)
      const cnum = options.quality && options.quality < 100 ? 256 : 0;
      
      // If loopDelay is set, we append a pure black frame for the duration of the delay
      if (options.loopDelay && options.loopDelay > 0) {
        const blackCanvas = document.createElement('canvas');
        blackCanvas.width = width;
        blackCanvas.height = height;
        const bCtx = blackCanvas.getContext('2d');
        if (bCtx) {
          bCtx.fillStyle = "#000000";
          bCtx.fillRect(0, 0, width, height);
          const blackData = bCtx.getImageData(0, 0, width, height).data;
          frames.push(blackData.buffer);
          delays.push(Math.round(options.loopDelay * 1000));
        }
      }

      const apngBuffer = UPNG.encode(frames, width, height, cnum, delays, options.loopCount !== undefined ? options.loopCount : 0);
      
      // Trigger Download
      const blob = new Blob([apngBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumina_export_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      // Cleanup
      Object.values(mediaElements).forEach(m => {
        if (m instanceof HTMLVideoElement) {
          m.pause();
          m.src = "";
          m.load();
        }
      });
      
    } catch (error) {
      console.error("APNG Export Failed:", error);
      alert("Failed to export APNG. See console for details.");
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    const newAssets: MediaAsset[] = fileList.map((file: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file), // Local blob URL for preview
      type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
      size: file.size,
    }));

    setState(prev => ({
      ...prev,
      assets: [...prev.assets, ...newAssets],
    }));
  };

  const handleAssetDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData("asset", JSON.stringify(asset));
  };

  const [dragOver, setDragOver] = useState(false);

  const handleTimelineDrop = (e: React.DragEvent) => {
    pushToHistory(state);
    e.preventDefault();
    setDragOver(false);
    const assetData = e.dataTransfer.getData("asset");
    if (!assetData || !timelineRef.current) return;

    const asset: MediaAsset = JSON.parse(assetData);
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 128 - 8;
    const y = e.clientY - rect.top - 8;
    
    const startTime = Math.max(0, x / state.zoomLevel);
    const trackIndex = Math.max(0, Math.min(2, Math.floor(y / 50))); // Roughly 50px per track including spacing

    const newClip: VideoClip = {
      id: Math.random().toString(36).substr(2, 9),
      name: asset.name,
      url: asset.url,
      type: asset.type,
      duration: 5,
      startTime: startTime,
      sourceStart: 0,
      sourceEnd: 5,
      trackIndex: trackIndex,
      volume: 1,
      speed: 1,
      transform: { scale: 1, rotation: 0 }
    };

    setState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
      selectedClipId: newClip.id
    }));
  };

  const removeAsset = (id: string) => {
    setState(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.id !== id),
      clips: prev.clips.filter(c => !prev.assets.find(a => a.id === id && a.url === c.url))
    }));
  };

  const clearAssets = () => {
    if (confirm("Are you sure you want to clear all assets and clips?")) {
      setState(prev => ({ ...prev, assets: [], clips: [], selectedClipId: null }));
    }
  };

  const timelineRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, show: boolean, targetId?: string } | null>(null);

  const handleApplyCrop = (crop: { x: number, y: number, width: number, height: number }) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === prev.selectedClipId ? {
        ...c,
        transform: { ...c.transform, crop }
      } : c)
    }));
    setShowCropTool(false);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Automatically select the clip on right-click for visual feedback
    if (targetId) {
      setState(prev => ({ ...prev, selectedClipId: targetId }));
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, show: true, targetId });
  }, []);

  const updateClipDuration = (id: string, delta: number, edge: 'start' | 'end') => {
    setState(prev => {
      const snapPoints = snapEnabled ? [
        prev.currentTime,
        ...prev.clips.filter(c => c.id !== id).map(c => c.startTime),
        ...prev.clips.filter(c => c.id !== id).map(c => c.startTime + c.duration)
      ] : [];

      return {
        ...prev,
        clips: prev.clips.map(c => {
          if (c.id !== id) return c;
          if (edge === 'start') {
            let newStart = c.startTime + delta;
            // Snap logic
            const snap = snapPoints.find(p => Math.abs(p - newStart) < 0.1);
            if (snap !== undefined) newStart = snap;
            
            newStart = Math.max(0, newStart);
            const newDuration = Math.max(0.1, c.duration - (newStart - c.startTime));
            return { ...c, startTime: newStart, duration: newDuration };
          } else {
            let newEnd = c.startTime + c.duration + delta;
            // Snap logic
            const snap = snapPoints.find(p => Math.abs(p - newEnd) < 0.1);
            if (snap !== undefined) newEnd = snap;

            const newDuration = Math.max(0.1, newEnd - c.startTime);
            return { ...c, duration: newDuration };
          }
        })
      };
    });
  };

  const handleTimelineInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    // Account for the 128px track label width + 8px padding
    const relativeX = x - rect.left - 128 - 8;
    const contentEnd = state.clips.length > 0 
      ? Math.max(...state.clips.map(c => c.startTime + c.duration)) 
      : state.duration;
    
    // Allow scrubbing slightly past for comfort, but bound by duration
    const newTime = Math.max(0, Math.min(contentEnd, relativeX / state.zoomLevel));
    setState(prev => ({ ...prev, currentTime: newTime }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only scrub on left click
    handleTimelineInteraction(e);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Cast moveEvent as any to bypass React-specific typing and use native clientX
      const relativeX = moveEvent.clientX - timelineRef.current!.getBoundingClientRect().left - 128 - 8;
      const contentEnd = state.clips.length > 0 
        ? Math.max(...state.clips.map(c => c.startTime + c.duration)) 
        : state.duration;
      
      const t = Math.max(0, Math.min(contentEnd, relativeX / state.zoomLevel));
      setState(prev => ({ ...prev, currentTime: t }));
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div 
      className="flex h-screen flex-col overflow-hidden font-sans select-none text-gray-300" 
      style={{ backgroundColor: THEME.bg }}
      onClick={() => setContextMenu(prev => prev ? { ...prev, show: false } : null)}
    >
      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu?.show && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-2xl p-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.targetId ? (
               <>
                <ContextItem label="Split at playhead" icon={<Scissor size={12}/>} onClick={() => handleSplit(contextMenu.targetId)} />
                <ContextItem label="Delete Clip" icon={<Trash2 size={12}/>} onClick={() => removeClip(contextMenu.targetId)} danger />
               </>
            ) : (
              <>
                <ContextItem label="Add Media" icon={<Plus size={12}/>} onClick={() => fileInputRef.current?.click()} />
                <ContextItem label="Split Selected" icon={<Scissor size={12}/>} onClick={() => handleSplit()} disabled={!state.selectedClipId} />
                <ContextItem label="Clear Project" icon={<Trash2 size={12}/>} onClick={clearAssets} danger />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Navigation */}
      <header className="h-12 border-b flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-20" style={{ borderColor: THEME.borderStrong }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-white rotate-45"></div>
            </div>
            <span className="font-bold text-white tracking-tight uppercase">Lumina <span className="text-blue-500">Pro</span></span>
          </div>
          <nav className="flex gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            <span className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "media" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("media")}>Edit</span>
            <span className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "effects" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("effects")}>Effects</span>
            <span className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "color" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("color")}>Color</span>
            <span className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "audio" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("audio")}>Audio</span>
            <span className={cn("cursor-pointer transition-colors", activeTab === "export" ? "text-orange-500" : "text-gray-500 hover:text-orange-400")} onClick={() => setActiveTab("export")}>APNG Route</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">4K @ 60FPS • {formatTime(state.currentTime)}</div>
          <button 
            onClick={() => setActiveTab("export")}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            Export Project
          </button>
        </div>
      </header>

      {/* Main Workspace (Bento Layout) */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        
        {/* Left: Assets & Settings Column */}
        <section className="w-64 flex flex-col gap-2" onContextMenu={(e) => handleContextMenu(e)}>
          <div className="rounded-lg border p-3 flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Media Assets</h3>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[10px] hover:border-gray-400 hover:text-white transition-colors"
              >
                +
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                multiple 
                accept="video/*,audio/*,image/*" 
                className="hidden" 
              />
            </div>
            <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar">
              {state.assets.map((asset) => (
                <div 
                  key={asset.id} 
                  draggable
                  onDragStart={(e) => handleAssetDragStart(e, asset)}
                  className="group aspect-video bg-gray-800 rounded relative overflow-hidden border border-white/5 cursor-grab hover:border-blue-500/30 transition-all active:cursor-grabbing"
                >
                  <div className="flex h-full w-full items-center justify-center bg-blue-500/5">
                    {asset.type === 'video' ? <Video className="h-4 w-4 text-blue-500/40" /> : 
                     asset.type === 'audio' ? <Music className="h-4 w-4 text-emerald-500/40" /> : 
                     <ImageIcon className="h-4 w-4 text-orange-500/40" />}
                  </div>
                  <div className="absolute bottom-1 left-1 text-[7px] bg-black/60 px-1 rounded font-bold truncate max-w-[80%]">{asset.name.split('.').pop()?.toUpperCase()}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
                  >
                    <Trash2 className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {state.assets.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center h-full opacity-20 py-8">
                  <Plus className="h-8 w-8 mb-2" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">No Assets</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="h-36 rounded-lg border p-3 flex flex-col" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Project Metrics</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]"><span className="text-gray-600">Resolution</span><span className="text-gray-300">3840 x 2160</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-gray-600">Sequence</span><span className="text-gray-300">Main_v1</span></div>
              <div className="flex justify-between text-[11px]"><span className="text-gray-600">Proxy Mode</span><span className="text-blue-500 font-bold uppercase text-[9px]">1/4 Res</span></div>
              <div className="flex justify-between text-[11px] pt-1 border-t border-white/5"><span className="text-gray-600">FPS</span><span className="text-gray-300">60.00</span></div>
            </div>
          </div>
        </section>

        {/* Center: Preview Section */}
        <section className="flex-1 flex flex-col gap-2">
          <div className="flex-1 bg-black rounded-lg border relative overflow-hidden flex items-center justify-center" style={{ borderColor: THEME.borderStrong }}>
            {/* Meta Info */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[10px] font-bold tracking-widest text-white/40 uppercase">Preview Node v0.8</span>
            </div>

            {/* Video Preview Canvas */}
            <div className="w-full h-full bg-gradient-to-br from-indigo-900/10 to-black flex items-center justify-center relative">
              <div className="w-[85%] aspect-video relative">
                <VideoCanvas 
                  clips={state.clips} 
                  currentTime={state.currentTime} 
                  width={1920} 
                  height={1080} 
                />
                
                {showCropTool && (
                  <CropTool 
                    onCropChange={() => {}} 
                    onApply={handleApplyCrop}
                    onCancel={() => setShowCropTool(false)}
                    initialCrop={state.clips.find(c => c.id === state.selectedClipId)?.transform.crop}
                  />
                )}
              </div>
            </div>

            {/* Preview Controls Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-6 py-2 rounded-full border border-white/10 flex items-center gap-8 shadow-2xl">
              <span className="text-xs font-mono tabular-nums tracking-tighter text-blue-400">{formatTime(state.currentTime)}</span>
              <div className="flex items-center gap-6">
                <button className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.max(0, s.currentTime - 1)}))}><SkipBack className="h-4 w-4" /></button>
                <button 
                  onClick={() => setState(s => ({ ...s, isPlaying: !s.isPlaying }))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-90 hover:scale-110"
                >
                  {state.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
                </button>
                <button className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.min(s.duration, s.currentTime + 1)}))}><SkipForward className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-3">
                <button className={cn("opacity-40 hover:opacity-100 transition-opacity", showCropTool && "opacity-100 text-blue-500")} onClick={() => setShowCropTool(!showCropTool)}><CropIcon className="h-4 w-4" /></button>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest pl-2 border-l border-white/10">1/4 Res</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Inspector (Contextual Focus) */}
        <section className="w-72 flex flex-col gap-2">
          <div className="rounded-lg border p-4 flex flex-col h-full overflow-hidden" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
            <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4 shrink-0">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                {activeTab === "export" ? "APNG Optimizer" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Controls`}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              {activeTab === "export" ? (
                <APNGConverter 
                  onConvert={handleConvert} 
                  isProcessing={isProcessing} 
                  progress={progress} 
                />
              ) : (
                <PropertyInspector 
                  state={state}
                  setState={setState}
                  activeTab={activeTab}
                />
              )}
            </div>

            <div className="mt-4 space-y-4 pt-6 border-t border-white/5 opacity-50 grayscale hover:grayscale-0 transition-all shrink-0">
              <div className="flex items-center gap-2">
                <Monitor className="h-3 w-3 text-gray-500" />
                <h4 className="text-[9px] font-bold uppercase tracking-widest">Global Output</h4>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-blue-600/40" />
                </div>
                <div className="flex justify-between text-[9px] font-mono"><span className="text-gray-600">Disk Cache</span><span>12.4 GB</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom: Timeline (Bento Style Footer) */}
      <footer className="h-64 border-t p-2 flex flex-col" style={{ backgroundColor: THEME.timeline, borderColor: THEME.borderStrong }}>
        {/* Timeline Control Bar */}
        <div className="h-10 flex items-center gap-4 px-2 mb-2">
          <div className="flex gap-1.5">
            <button 
              onClick={() => handleSplit()}
              className={cn(
                "w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 active:scale-95 transition-all",
                !state.selectedClipId && "opacity-30 cursor-not-allowed"
              )}
            >
              <Scissor className="h-4 w-4" />
            </button>
            <button className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-sm shadow-lg shadow-blue-600/20 active:scale-90 transition-all pointer-events-none opacity-50"><Combine className="h-4 w-4" /></button>
            <button className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-bold border border-white/5 hover:bg-gray-700 transition-all">T</button>
            <button 
              onClick={() => setSnapEnabled(!snapEnabled)}
              title="Toggle Snapping"
              className={cn(
                "w-8 h-8 rounded flex items-center justify-center text-sm border border-white/5 transition-all",
                snapEnabled ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-gray-800 text-gray-500 hover:bg-gray-700"
              )}
            >
              <Zap className={cn("h-4 w-4", snapEnabled && "fill-current")} />
            </button>
            <div className="w-px h-6 bg-white/5 mx-2" />
            <button 
              onClick={undo}
              disabled={history.undo.length === 0}
              className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 disabled:opacity-20 transition-all"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 bg-black/40 h-8 rounded-lg flex items-center px-4 gap-8 overflow-hidden font-mono text-[10px] text-gray-600 border border-white/5">
             {Array.from({ length: Math.ceil(state.duration / 5) }).map((_, i) => (
               <span key={i} className="shrink-0">{formatTime(i * 5)}</span>
             ))}
          </div>
          <div className="flex items-center gap-3 bg-black/40 h-8 px-3 rounded-lg border border-white/5">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Zoom</span>
            <input 
              type="range" min="50" max="300" value={state.zoomLevel}
              onChange={(e) => setState(s => ({ ...s, zoomLevel: parseInt(e.target.value) }))}
              className="w-24 h-1 accent-blue-600 bg-white/10 rounded-full cursor-pointer" 
            />
          </div>
        </div>
        
        {/* Tracks Area Bento */}
        <div 
          ref={timelineRef}
          onMouseDown={handleMouseDown}
          onContextMenu={(e) => handleContextMenu(e)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleTimelineDrop}
          className={cn(
            "flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative border rounded-lg p-2 bg-black/20 cursor-crosshair transition-colors",
            dragOver ? "border-blue-500/50 bg-blue-500/5" : "border-white/10"
          )}
        >
          {/* Interactive Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-4 -ml-2 z-50 transition-none cursor-ew-resize group/playhead"
            style={{ left: state.currentTime * state.zoomLevel + 128 + 8 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e);
            }}
          >
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red-500/80 shadow-[0_0_15px_red]"></div>
            <div className="w-4 h-4 bg-red-500 absolute -top-1.5 left-1/2 -ml-2 rounded-full shadow-[0_0_15px_red] ring-4 ring-red-500/20 group-active/playhead:scale-125 transition-transform"></div>
          </div>
          
          <div className="space-y-1.5 min-w-max">
            <Track 
              label="Video 1" 
              icon={<Video />} 
              clips={state.clips.filter(c => c.trackIndex === 0)} 
              zoom={state.zoomLevel} 
              onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
              onSelect={(id: string) => setState(s => ({...s, selectedClipId: id}))}
              onMove={updateClipPosition}
              onTrim={updateClipDuration}
              selectedId={state.selectedClipId}
              onContextMenu={handleContextMenu}
            />
            <Track 
              label="Overlay" 
              icon={<Layers />} 
              clips={state.clips.filter(c => c.trackIndex === 1)} 
              zoom={state.zoomLevel} 
              onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
              onSelect={(id: string) => setState(s => ({...s, selectedClipId: id}))}
              onMove={updateClipPosition}
              onTrim={updateClipDuration}
              selectedId={state.selectedClipId}
              onContextMenu={handleContextMenu}
            />
            <Track 
              label="Audio" 
              icon={<Music />} 
              clips={state.clips.filter(c => c.trackIndex === 2)} 
              zoom={state.zoomLevel} 
              onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
              onSelect={(id: string) => setState(s => ({...s, selectedClipId: id}))}
              onMove={updateClipPosition}
              onTrim={updateClipDuration}
              selectedId={state.selectedClipId}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }
      `}} />
    </div>
  );
}

function Track({ label, icon, clips, zoom, onSeek, onSelect, onMove, onTrim, selectedId, onContextMenu }: any) {
  return (
    <div className="relative h-12 flex items-center bg-white/[0.02] rounded-lg border border-white/[0.03] w-max min-w-full">
      <div className="w-32 sticky left-0 h-full flex items-center px-4 text-[10px] uppercase font-bold text-gray-500 border-r border-white/5 bg-[#121212] z-[60] shrink-0">
        <div className="flex items-center gap-2">
          {React.cloneElement(icon, { size: 12, className: "opacity-40" })}
          <span className="tracking-widest">{label}</span>
        </div>
      </div>
      <div className="flex-1 relative h-full min-w-[3000px]">
        {clips?.map((c: any) => (
          <motion.div 
            key={`${c.id}-${c.startTime}`}
            drag={selectedId === c.id ? "x" : false}
            dragMomentum={false}
            dragConstraints={{ left: -c.startTime * zoom }}
            dragElastic={0}
            onMouseDown={(e) => e.stopPropagation()}
            onDragEnd={(e, info) => {
              const deltaX = info.offset.x;
              onMove(c.id, c.startTime + deltaX / zoom);
            }}
            onContextMenu={(e) => onContextMenu(e, c.id)}
            className={cn(
              "absolute h-10 top-1 rounded-md border flex items-start pt-1 px-1 cursor-grab overflow-hidden active:cursor-grabbing shadow-lg group/clip transition-all duration-200",
              selectedId === c.id ? "ring-2 ring-white/50 z-20 scale-[1.02]" : "z-10",
              label === "Video 1" ? (selectedId === c.id ? "bg-blue-500 border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "bg-blue-600/30 border-blue-500/50 hover:bg-blue-600/40") :
              label === "Overlay" ? (selectedId === c.id ? "bg-purple-500 border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]" : "bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/40") :
              (selectedId === c.id ? "bg-emerald-500 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-emerald-600/30 border-emerald-500/50 hover:bg-emerald-600/40")
            )}
            style={{ left: c.startTime * zoom, width: (c.duration) * zoom }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.id);
            }}
          >
            {/* Trim Handles */}
            {selectedId === c.id && (
              <>
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize z-30"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const onMouseMove = (me: MouseEvent) => {
                      const delta = (me.clientX - startX) / zoom;
                      onTrim(c.id, delta, 'start');
                    };
                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                />
                <div 
                  className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/20 cursor-ew-resize z-30"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const startX = e.clientX;
                    const onMouseMove = (me: MouseEvent) => {
                      const delta = (me.clientX - startX) / zoom;
                      onTrim(c.id, delta, 'end');
                    };
                    const onMouseUp = () => {
                      window.removeEventListener('mousemove', onMouseMove);
                      window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                  }}
                />
              </>
            )}
            
            {c.type === 'video' && (
              <Filmstrip 
                url={c.url} 
                duration={c.duration} 
                zoom={zoom} 
                sourceStart={c.sourceStart} 
                sourceEnd={c.sourceEnd} 
              />
            )}
            
            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full z-20 shadow-sm" style={{ 
              backgroundColor: label === "Video 1" ? "#3B82F6" : label === "Overlay" ? "#A855F7" : "#10B981" 
            }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ContextItem({ label, icon, onClick, danger, disabled }: any) {
  return (
    <button 
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-[11px] uppercase font-bold tracking-widest rounded-md transition-all active:scale-95",
        danger ? "text-red-500 hover:bg-red-500/20" : "text-gray-200 hover:bg-white/10",
        disabled ? "opacity-20 cursor-not-allowed hover:bg-transparent" : "cursor-pointer"
      )}
    >
      <div className={cn("p-1 rounded bg-white/5", danger && "bg-red-500/10")}>
        {React.cloneElement(icon, { size: 11 })}
      </div>
      {label}
    </button>
  );
}
