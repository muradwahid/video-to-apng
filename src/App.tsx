import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Scissors as Scissor, Combine, 
  Crop as CropIcon, Layers, Download, Plus, Video, Music,
  Settings, History, Maximize2, Trash2, Sliders, Image as ImageIcon,
  Monitor, Info, Zap, RefreshCw, Volume2, Loader2,
  Palette, Grid, ArrowRightLeft, LayoutTemplate, Sparkles, Wand2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatTime } from "@/src/lib/utils";
import { VideoClip, TimelineState, APNGOptions, MediaAsset } from "@/src/types";
import { VideoCanvas } from "@/src/components/VideoCanvas";
import { CropTool } from "@/src/components/CropTool";
import { APNGConverter } from "@/src/components/APNGConverter";
import { PropertyInspector } from "@/src/components/PropertyInspector";
import { renderBackground, renderClip, renderClipWithTransition } from "@/src/lib/renderer";
import { BackgroundPanel } from "@/src/components/BackgroundPanel";
import { TransitionPanel } from "@/src/components/TransitionPanel";
import { TemplatePanel } from "@/src/components/TemplatePanel";
import { Filmstrip } from "@/src/components/Filmstrip";
import { AudioWaveform } from "@/src/components/AudioWaveform";
import { audioEngine } from "@/src/services/audioEngine";
import UPNG from "upng-js";
import pako from "pako";
import * as WebMMuxer from 'webm-muxer';

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
    zoomLevel: 100, // pixels per second
    background: {
      type: 'solid',
      color: '#000000',
      opacity: 1,
      blurIntensity: 0,
      fit: 'cover'
    },
    transitions: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"media" | "effects" | "color" | "audio" | "export">("media");
  const [showCropTool, setShowCropTool] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [showVideoExportModal, setShowVideoExportModal] = useState(false);
  const [videoExportConfig, setVideoExportConfig] = useState({ quality: '1080p', fps: 0 });
  const [exportMimeType, setExportMimeType] = useState('video/webm');

  // Find supported mime type on mount
  useEffect(() => {
    const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        setExportMimeType(t);
        break;
      }
    }
  }, []);

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [sidebarTab, setSidebarTab] = useState<"assets" | "templates" | "background" | "transitions">("assets");

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

      const clipDuration = prev.clips.find(c => c.id === id)?.duration || 0;
      
      return {
        ...prev,
        clips: prev.clips.map(c => c.id === id ? { ...c, startTime: t } : c),
        duration: Math.max(prev.duration, t + clipDuration + 5)
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
        selectedClipId: clipB.id,
        duration: Math.max(prev.duration, clipB.startTime + clipB.duration + 5)
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

  const handleResetTab = useCallback(() => {
    setState(prev => {
      const selected = prev.clips.find(c => c.id === prev.selectedClipId);
      if (!selected) return prev;

      // Push history before resetting
      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      const newClips = prev.clips.map(c => {
        if (c.id !== prev.selectedClipId) return c;
        const n = JSON.parse(JSON.stringify(c)) as VideoClip;
        switch (activeTab) {
          case 'media':
            n.transform.scale = 1;
            n.transform.x = 0;
            n.transform.y = 0;
            n.transform.rotation = 0;
            n.transform.opacity = 1;
            n.speed = 1;
            n.transform.crop = undefined;
            break;
          case 'effects':
             if (n.filters) {
               n.filters.blur = 0;
               n.filters.grayscale = 0;
               n.filters.sepia = 0;
               n.filters.invert = 0;
               n.filters.vignette = 0;
               n.filters.grain = 0;
             }
             break;
          case 'color':
             if (n.filters) {
               n.filters.brightness = 1;
               n.filters.contrast = 1;
               n.filters.saturation = 1;
             }
             break;
          case 'audio':
             n.audio = { volume: 1, fadeIn: 0, fadeOut: 0, muted: false };
             break;
        }
        return n;
      });

      return { ...prev, clips: newClips };
    });
  }, [activeTab]);

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

  useEffect(() => {
    if (state.isPlaying) {
      audioEngine.resume();
      state.clips.forEach(clip => {
        if (clip.type === 'video' || clip.type === 'audio') {
          audioEngine.playClip(clip, state.currentTime, true);
        }
      });
    } else {
      audioEngine.stopAll();
    }
  }, [state.isPlaying]);

  // Sync audio if currentTime changes manually (scrubbing)
  useEffect(() => {
    if (!state.isPlaying) {
      audioEngine.stopAll();
    }
  }, [state.currentTime]);

  const handleExportVideo = async () => {
    if (state.clips.length === 0) return;
    
    // Check for WebCodecs support
    if (!window.VideoEncoder) {
      alert("Your browser does not support WebCodecs. Please use the latest version of Chrome or Edge.");
      return;
    }
    
    // Stop playback and audio engine to prevent background interference
    setState(prev => ({ ...prev, isPlaying: false }));
    audioEngine.stopAll();
    
    setIsProcessing(true);
    setProgress(0);
    setShowVideoExportModal(false);

    try {
      const resolutionMap: Record<string, {w: number, h: number}> = {
        '4k': { w: 3840, h: 2160 },
        '1080p': { w: 1920, h: 1080 },
        '720p': { w: 1280, h: 720 },
      };
      
      const res = resolutionMap[videoExportConfig.quality.toLowerCase()] || resolutionMap['1080p'];
      const width = res.w;
      const height = res.h;
      // Handle '0' as Auto/Default FPS (setting to 60 for high quality default)
      const fps = videoExportConfig.fps === 0 ? 60 : videoExportConfig.fps;

      const minStartTime = state.clips.length > 0 ? Math.min(...state.clips.map(c => c.startTime)) : 0;
      const maxEndTime = state.clips.length > 0 ? Math.max(...state.clips.map(c => c.startTime + c.duration)) : 0;
      const durationSeconds = maxEndTime - minStartTime;
      const totalFrames = Math.ceil(durationSeconds * fps);

      if (totalFrames <= 0) throw new Error("Timeline is empty or invalid duration");

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!ctx) throw new Error("Could not get 2d context");

      // Preload media
      const mediaElements: Record<string, HTMLVideoElement | HTMLImageElement> = {};
      const uniqueUrls = Array.from(new Set(state.clips.map(c => c.url)));
      const uniqueMedia = uniqueUrls.map(url => {
        const clip = state.clips.find(c => c.url === url)!;
        return { url: clip.url, type: clip.type, name: clip.name };
      });
      
      if (state.background.mediaUrl) {
        uniqueMedia.push({ 
          url: state.background.mediaUrl, 
          type: state.background.type === 'video' ? 'video' : 'image',
          name: 'Background'
        });
      }

      await Promise.all(uniqueMedia.map(async (item) => {
        if (mediaElements[item.url]) return;
        return new Promise<void>((resolve, reject) => {
          if (item.type === 'video') {
            const vid = document.createElement('video');
            vid.src = item.url;
            vid.crossOrigin = "anonymous";
            vid.muted = true;
            vid.preload = "auto";
            vid.onloadeddata = () => { mediaElements[item.url] = vid; resolve(); };
            vid.onerror = () => reject(new Error(`Failed to load video: ${item.name}`));
            setTimeout(() => { if (!mediaElements[item.url]) reject(new Error(`Timeout loading: ${item.name}`)); }, 15000);
          } else if (item.type === 'image') {
            const img = new Image();
            img.src = item.url;
            img.crossOrigin = "anonymous";
            img.onload = () => { mediaElements[item.url] = img; resolve(); };
            img.onerror = () => reject(new Error(`Failed to load image: ${item.name}`));
          } else {
            resolve();
          }
        });
      }));

      // Set up Muxer and Encoder
      const muxer = new WebMMuxer.Muxer({
        target: new WebMMuxer.ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width,
          height,
          frameRate: fps
        }
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
        error: (e) => console.error("WebCodecs Encoding Error:", e)
      });

      videoEncoder.configure({
        codec: 'vp09.00.10.08',
        width,
        height,
        bitrate: videoExportConfig.quality === '4k' ? 40000000 : 12000000,
      });

      // Seeking helper
      const seekVideo = async (video: HTMLVideoElement, targetTime: number) => {
        if (Math.abs(video.currentTime - targetTime) < 0.01) return;
        
        return new Promise<void>((resolve) => {
          let resolved = false;
          const onSeeked = () => {
            if (resolved) return;
            resolved = true;
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          
          try {
            video.currentTime = targetTime;
          } catch (e) {
            resolved = true;
            resolve();
            return;
          }

          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              video.removeEventListener('seeked', onSeeked);
              resolve();
            }
          }, 150); 
        });
      };

      for (let i = 0; i < totalFrames; i++) {
        const absoluteTime = minStartTime + (i / fps);
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        renderBackground(ctx, width, height, state.background, mediaElements, absoluteTime);

        const activeTransition = state.transitions.find(t => {
          const fromClip = state.clips.find(c => c.id === t.fromClipId);
          if (!fromClip) return false;
          const junction = fromClip.startTime + fromClip.duration;
          return absoluteTime >= junction - t.duration / 2 && absoluteTime <= junction + t.duration / 2;
        });

        if (activeTransition) {
          const fromClip = state.clips.find(c => c.id === activeTransition.fromClipId)!;
          const toClip = state.clips.find(c => c.id === activeTransition.toClipId)!;
          const junction = fromClip.startTime + fromClip.duration;
          const progress = (absoluteTime - (junction - activeTransition.duration / 2)) / activeTransition.duration;

          await Promise.all([fromClip, toClip].map(async (clip) => {
            const media = mediaElements[clip.url];
            if (clip.type === 'video' && media instanceof HTMLVideoElement) {
              const relativeTime = (absoluteTime - clip.startTime) * (clip.speed || 1) + clip.sourceStart;
              await seekVideo(media, Math.min(relativeTime, media.duration - 0.05));
            }
          }));

          renderClipWithTransition(ctx, width, height, fromClip, toClip, activeTransition.type, progress, mediaElements);
        } else {
          const activeClips = state.clips
            .filter(c => absoluteTime >= c.startTime && absoluteTime < (c.startTime + c.duration))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));
          
          for (const clip of activeClips) {
            const media = mediaElements[clip.url];
            if (clip.type === 'video' && media instanceof HTMLVideoElement) {
              const relativeTime = (absoluteTime - clip.startTime) * (clip.speed || 1) + clip.sourceStart;
              await seekVideo(media, Math.min(relativeTime, media.duration - 0.05));
            }
            renderClip(ctx, width, height, clip, mediaElements);
          }
        }
        
        const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1000000) / fps) });
        videoEncoder.encode(frame);
        frame.close();
        
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 0));
          setProgress((i + 1) / totalFrames);
        }
      }

      await videoEncoder.flush();
      videoEncoder.close();
      muxer.finalize();

      const buffer = (muxer.target as WebMMuxer.ArrayBufferTarget).buffer;
      const blob = new Blob([buffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_export_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      // Cleanup
      Object.values(mediaElements).forEach(m => {
        if (m instanceof HTMLVideoElement) {
          m.pause();
          m.src = "";
          m.load();
          m.remove();
        }
      });
    } catch (error) {
      console.error("Export Error:", error);
      alert(`Export failed: ${error instanceof Error ? error.message : "Details in console"}`);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

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
      
      await Promise.all(urls.map((url: string) => {
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

      const renderFrameAtTime = async (time: number, absoluteTime: number) => {
        // Solid black background prevents "transparency blinks" at loop points or between clips
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

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
            const relativeTime = (absoluteTime - clip.startTime) * clip.speed + clip.sourceStart;
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
                x * width, y * height, cw * width, ch * height
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
      };

        // Output APNG
        for (let i = 0; i < totalFrames; i++) {
          const absoluteTime = minStartTime + (i / fps);
          await renderFrameAtTime(absoluteTime, absoluteTime);

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

  const getMediaDuration = (url: string, type: 'video' | 'audio'): Promise<number> => {
    return new Promise((resolve) => {
      const media = document.createElement(type);
      media.onloadedmetadata = () => resolve(media.duration);
      media.onerror = () => resolve(5); // fallback
      media.src = url;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    const newAssetsPromises = fileList.map(async (file: File) => {
      const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
      const url = URL.createObjectURL(file);
      let duration = 5; // default for images
      let waveform: number[] | undefined;
      
      if (type === 'video' || type === 'audio') {
        duration = await getMediaDuration(url, type);
        try {
          const buffer = await audioEngine.loadAudio(url, file.name);
          waveform = audioEngine.getWaveform(buffer);
        } catch (e) {
          console.warn("Waveform extraction failed:", e);
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url,
        type,
        size: file.size,
        duration,
        audioWaveform: waveform
      } as MediaAsset;
    });

    const newAssets = await Promise.all(newAssetsPromises);

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
    
    const transitionType = e.dataTransfer.getData("application/transition-type");
    const assetData = e.dataTransfer.getData("asset");

    if (transitionType && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 128 - 8;
      const dropTime = Math.max(0, x / state.zoomLevel);
      
      // Find clips that are adjacent or overlapping at the drop point
      // We look for a junction point (end of one, start of another)
      const fromClip = state.clips.find(c => Math.abs((c.startTime + c.duration) - dropTime) < 0.5);
      const toClip = state.clips.find(c => Math.abs(c.startTime - dropTime) < 0.5);
      
      if (fromClip && toClip && fromClip.id !== toClip.id) {
        // Remove any existing transition between these two clips
        const filteredTransitions = state.transitions.filter(t => 
          !(t.fromClipId === fromClip.id && t.toClipId === toClip.id)
        );

        const newTransition: any = {
          id: Math.random().toString(36).substr(2, 9),
          type: transitionType,
          duration: 0.5, // Pro standard: 0.5s default
          fromClipId: fromClip.id,
          toClipId: toClip.id,
          easing: 'ease-in-out'
        };
        setState(prev => ({ ...prev, transitions: [...filteredTransitions, newTransition] }));
      }
      return;
    }

    if (!assetData || !timelineRef.current) return;

    const asset: MediaAsset = JSON.parse(assetData);
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 128 - 8;
    const y = e.clientY - rect.top - 8;
    
    const startTime = Math.max(0, x / state.zoomLevel);
    const trackIndex = Math.max(0, Math.min(3, Math.floor(y / 50))); // Roughly 50px per track including spacing

    const newClip: VideoClip = {
      id: Math.random().toString(36).substr(2, 9),
      name: asset.name,
      url: asset.url,
      type: asset.type,
      duration: asset.duration || 5,
      startTime: startTime,
      sourceStart: 0,
      sourceEnd: asset.duration || 5,
      trackIndex: trackIndex,
      volume: 1,
      speed: 1,
      transform: { scale: 1, rotation: 0 },
      audio: {
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        muted: false,
        waveform: asset.audioWaveform
      }
    };

    setState(prev => ({
      ...prev,
      clips: [...prev.clips, newClip],
      selectedClipId: newClip.id,
      duration: Math.max(prev.duration, startTime + newClip.duration + 5) // Add 5 sec padding
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

  const applyTemplate = (templateId: string) => {
    pushToHistory(state);
    
    interface TemplateType {
      id: string;
      name: string;
      category: string;
      thumbnail: string;
      structure: {
        background: any;
        clips: any[];
        transitions?: any[];
      };
    }

    const templateLibrary: Record<string, TemplateType> = {
      'youtube-outro': {
        id: 'youtube-outro',
        name: 'YouTube Outro',
        category: 'social',
        thumbnail: '',
        structure: {
          background: { type: 'gradient', gradient: { from: '#0f0c29', to: '#302b63', angle: 45 }, fit: 'cover', overlayOpacity: 0.1, overlayColor: '#000000' },
          clips: [
            { id: 'placeholder-1', name: 'Insert Video Here', url: '', type: 'video', duration: 10, startTime: 0, sourceStart: 0, sourceEnd: 10, trackIndex: 0, volume: 1, speed: 1, transform: { scale: 0.8, rotation: 0 }, audio: { volume: 1, muted: false, fadeIn: 0.5, fadeOut: 0.5 } }
          ],
          transitions: []
        }
      },
      'cinematic-story': {
        id: 'cinematic-story',
        name: 'Cinematic Story',
        category: 'marketing',
        thumbnail: '',
        structure: {
          background: { type: 'solid', color: '#000000', fit: 'cover' },
          clips: [
             { id: 'sc-1', name: 'Scene 1', url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=60&w=800', type: 'image', duration: 3, startTime: 0, sourceStart: 0, sourceEnd: 3, trackIndex: 0, volume: 1, speed: 1, transform: { scale: 1, rotation: 0 }, audio: { volume: 1, muted: false, fadeIn: 0.5, fadeOut: 0.5 } },
             { id: 'sc-2', name: 'Scene 2', url: 'https://images.unsplash.com/photo-1549241520-425e3dfc01cd?auto=format&fit=crop&q=60&w=800', type: 'image', duration: 3, startTime: 3, sourceStart: 0, sourceEnd: 3, trackIndex: 0, volume: 1, speed: 1, transform: { scale: 1, rotation: 0 }, audio: { volume: 1, muted: false, fadeIn: 0.5, fadeOut: 0.5 } }
          ],
          transitions: [
             { id: 'tr-1', type: 'fade', duration: 1, fromClipId: 'sc-1', toClipId: 'sc-2', easing: 'linear' }
          ]
        }
      }
    };

    const template = templateLibrary[templateId];
    if (template) {
       setState(prev => ({
         ...prev,
         background: template.structure.background,
         clips: template.structure.clips,
         transitions: template.structure.transitions || [],
         duration: 30,
         selectedClipId: null
       }));
    }
  };

  const handleAutoSyncTransitions = () => {
    pushToHistory(state);
    
    // Sort clips on track 0 by start time
    const track0Clips = [...state.clips]
      .filter(c => c.trackIndex === 0)
      .sort((a, b) => a.startTime - b.startTime);
    
    if (track0Clips.length < 2) return;
    
    const newTransitions: any[] = [...state.transitions];
    let addedCount = 0;
    
    const types = ['cross-dissolve', 'fade', 'blur', 'glitch', 'wipe', 'iris', 'rotate', 'spiral'];
    
    for (let i = 0; i < track0Clips.length - 1; i++) {
       const current = track0Clips[i];
       const next = track0Clips[i+1];
       const junction = current.startTime + current.duration;
       
       // Detect gaps or junctions (within 1s)
       if (Math.abs(junction - next.startTime) < 1.0) {
          // Check if a transition already exists between these two
          const exists = newTransitions.find(t => 
            (t.fromClipId === current.id && t.toClipId === next.id) ||
            (t.fromClipId === next.id && t.toClipId === current.id)
          );
          
          if (!exists) {
             const randomType = types[Math.floor(Math.random() * types.length)];
             newTransitions.push({
               id: Math.random().toString(36).substr(2, 9),
               type: randomType,
               duration: 0.8,
               fromClipId: current.id,
               toClipId: next.id,
               easing: 'ease-in-out'
             });
             addedCount++;
          }
       }
    }
    
    if (addedCount > 0) {
       setState(prev => ({ ...prev, transitions: newTransitions }));
    }
  };

  const handleApplyCrop = (crop: { x: number, y: number, width: number, height: number }) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        if (c.id === prev.selectedClipId) {
          // Un-apply the scale so the screen crop dimensions map relative to the intrinsic source
          const S = c.transform.scale || 1;
          let newX = 0.5 + (crop.x - 0.5) / S;
          let newY = 0.5 + (crop.y - 0.5) / S;
          let newW = crop.width / S;
          let newH = crop.height / S;
          
          // Clamp to intrinsic source bounds [0, 1]
          if (newX < 0) {
            newW += newX; 
            newX = 0;
          }
          if (newY < 0) {
            newH += newY;
            newY = 0;
          }
          if (newX + newW > 1) {
            newW = 1 - newX;
          }
          if (newY + newH > 1) {
            newH = 1 - newY;
          }

          const transformedCrop = {
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };
          
          return {
            ...c,
            transform: { ...c.transform, crop: transformedCrop }
          };
        }
        return c;
      })
    }));
    setShowCropTool(false);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, targetId?: string, type: 'clip' | 'transition' = 'clip') => {
    e.preventDefault();
    e.stopPropagation();
    
    // Automatically select the clip on right-click for visual feedback
    if (targetId && type === 'clip') {
      setState(prev => ({ ...prev, selectedClipId: targetId }));
    }
    
    setContextMenu({ x: e.clientX, y: e.clientY, show: true, targetId, type } as any);
  }, []);

  const updateClipDuration = (id: string, delta: number, edge: 'start' | 'end') => {
    setState(prev => {
      const snapPoints = snapEnabled ? [
        prev.currentTime,
        ...prev.clips.filter(c => c.id !== id).map(c => c.startTime),
        ...prev.clips.filter(c => c.id !== id).map(c => c.startTime + c.duration)
      ] : [];

      let maxTime = prev.duration;

      const newClips = prev.clips.map(c => {
        if (c.id !== id) {
          maxTime = Math.max(maxTime, c.startTime + c.duration);
          return c;
        }
        if (edge === 'start') {
          let newStart = c.startTime + delta;
          // Snap logic
          const snap = snapPoints.find(p => Math.abs(p - newStart) < 0.1);
          if (snap !== undefined) newStart = snap;
          
          newStart = Math.max(0, newStart);
          const newDuration = Math.max(0.1, c.duration - (newStart - c.startTime));
          maxTime = Math.max(maxTime, newStart + newDuration);
          return { ...c, startTime: newStart, duration: newDuration };
        } else {
          let newEnd = c.startTime + c.duration + delta;
          // Snap logic
          const snap = snapPoints.find(p => Math.abs(p - newEnd) < 0.1);
          if (snap !== undefined) newEnd = snap;

          const newDuration = Math.max(0.1, newEnd - c.startTime);
          maxTime = Math.max(maxTime, c.startTime + newDuration);
          return { ...c, duration: newDuration };
        }
      });

      return {
        ...prev,
        clips: newClips,
        duration: Math.max(prev.duration, maxTime + 5)
      };
    });
  };

  const [isAssetDragOver, setIsAssetDragOver] = useState(false);

  const handleAssetDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsAssetDragOver(true);
    }
  };

  const handleAssetDragLeave = (e: React.DragEvent) => {
    setIsAssetDragOver(false);
  };

  const handleAssetDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsAssetDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      const newAssetsPromises = fileList.map(async (file: File) => {
        const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
        const url = URL.createObjectURL(file);
        let duration = 5; // default for images
        let waveform: number[] | undefined;
        
        if (type === 'video' || type === 'audio') {
          duration = await getMediaDuration(url, type);
          try {
            const buffer = await audioEngine.loadAudio(url, file.name);
            waveform = audioEngine.getWaveform(buffer);
          } catch (e) {
            console.warn("Waveform extraction failed:", e);
          }
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
          type,
          size: file.size,
          duration,
          audioWaveform: waveform
        } as MediaAsset;
      });

      const newAssets = await Promise.all(newAssetsPromises);
      setState(prev => ({ ...prev, assets: [...prev.assets, ...newAssets] }));
    }
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
            {(contextMenu as any).type === 'transition' ? (
               <ContextItem 
                 label="Remove Transition" 
                 tooltip="Delete this transition effect" 
                 icon={<Trash2 size={12}/>} 
                 onClick={() => {
                   pushToHistory(state);
                   setState(prev => ({
                     ...prev,
                     transitions: prev.transitions.filter(t => t.id !== contextMenu.targetId)
                   }));
                   setContextMenu(prev => prev ? { ...prev, show: false } : null);
                 }} 
                 danger 
               />
            ) : contextMenu.targetId ? (
                <>
                 <ContextItem label="Split at playhead" tooltip="Split this clip precisely at the current playhead position" icon={<Scissor size={12}/>} onClick={() => { handleSplit(contextMenu.targetId); setContextMenu(prev => prev ? { ...prev, show: false } : null); }} />
                 <ContextItem 
                   label={state.clips.find(c => c.id === contextMenu.targetId)?.audio?.muted ? "Unmute Clip" : "Mute Clip"} 
                   tooltip="Toggle audio for this clip" 
                   icon={<Volume2 size={12}/>} 
                   onClick={() => {
                     const targetId = contextMenu.targetId;
                     setState(prev => {
                       const newClips = prev.clips.map(c => {
                         if (c.id !== targetId) return c;
                         const newClip = {
                           ...c,
                           audio: {
                             ...(c.audio || {}),
                             volume: 1, fadeIn: 0, fadeOut: 0, 
                             muted: !(c.audio?.muted ?? false)
                           }
                         };
                         audioEngine.updateClipAudio(newClip);
                         return newClip;
                       });
                       return { ...prev, clips: newClips };
                     });
                     setContextMenu(prev => prev ? { ...prev, show: false } : null);
                   }} 
                 />
                 <ContextItem label="Delete Clip" tooltip="Remove this clip from the timeline" icon={<Trash2 size={12}/>} onClick={() => { removeClip(contextMenu.targetId); setContextMenu(prev => prev ? { ...prev, show: false } : null); }} danger />
                </>
             ) : (
               <>
                 <ContextItem label="Add Media" tooltip="Import new media to project" icon={<Plus size={12}/>} onClick={() => { fileInputRef.current?.click(); setContextMenu(prev => prev ? { ...prev, show: false } : null); }} />
                 <ContextItem label="Split Selected" tooltip="Split the currently selected clip at the playhead" icon={<Scissor size={12}/>} onClick={() => { handleSplit(); setContextMenu(prev => prev ? { ...prev, show: false } : null); }} disabled={!state.selectedClipId} />
                 <ContextItem label="Clear Project" tooltip="Remove all assets and reset the project" icon={<Trash2 size={12}/>} onClick={() => { clearAssets(); setContextMenu(prev => prev ? { ...prev, show: false } : null); }} danger />
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
          </div>
          <nav className="flex gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            <span title="Edit basic positioning and timeline placement" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "media" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("media")}>Edit</span>
            <span title="Add visual filters and distortion effects" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "effects" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("effects")}>Effects</span>
            <span title="Perform color grading and color correction" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "color" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("color")}>Color</span>
            <span title="Adjust sound levels and audio fading" className={cn("cursor-pointer transition-colors hover:text-white", activeTab === "audio" && "text-white border-b border-blue-500")} onClick={() => setActiveTab("audio")}>Audio</span>
            <span title="Optimize and export frames as an Animated PNG" className={cn("cursor-pointer transition-colors", activeTab === "export" ? "text-orange-500" : "text-gray-500 hover:text-orange-400")} onClick={() => setActiveTab("export")}>APNG Route</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">4K @ 60FPS • {formatTime(state.currentTime)}</div>
          <button 
            onClick={() => setShowVideoExportModal(true)}
            title="Open Export Settings to quickly save out your video"
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-600/20"
          >
            Export Video
          </button>
        </div>
      </header>

      {/* Main Workspace (Bento Layout) */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        
        {/* Left: Assets & Settings Column */}
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
                    <div className="flex items-center justify-between mb-3 z-10">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Media Assets</h3>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[10px] hover:border-gray-400 hover:text-white transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-3 pb-4">
                      {state.assets.map((asset) => (
                        <div key={asset.id} className="flex flex-col gap-1.5" title={`Drag ${asset.name} into the timeline to use`}>
                          <div 
                            draggable
                            onDragStart={(e) => handleAssetDragStart(e, asset)}
                            className="group aspect-video bg-gray-800 rounded relative overflow-hidden border border-white/5 cursor-grab hover:border-blue-500/30 transition-all active:cursor-grabbing"
                          >
                            <div className="flex h-full w-full items-center justify-center bg-blue-500/5">
                              {asset.type === 'video' ? <Video className="h-4 w-4 text-blue-500/40" /> : 
                               asset.type === 'audio' ? <Music className="h-4 w-4 text-emerald-500/40" /> : 
                               <ImageIcon className="h-4 w-4 text-orange-500/40" />}
                            </div>
                            <div className="absolute top-1 left-1 text-[7px] bg-black/60 px-1 rounded font-bold uppercase">{asset.type}</div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeAsset(asset.id); }}
                              className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
                            >
                              <Trash2 className="h-3 w-3 text-white" />
                            </button>
                          </div>
                          <span className="text-[9px] text-gray-400 truncate leading-tight hover:text-white transition-colors cursor-default" title={asset.name}>{asset.name}</span>
                        </div>
                      ))}
                      {state.assets.length === 0 && (
                        <div className="col-span-2 flex flex-col items-center justify-center h-full opacity-20 py-8">
                          <Plus className="h-8 w-8 mb-2" />
                          <span className="text-[10px] uppercase font-bold tracking-widest text-center px-4">Import Media</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {sidebarTab === 'templates' && (
                  <motion.div
                    key="templates"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <TemplatePanel onApply={applyTemplate} />
                  </motion.div>
                )}

                {sidebarTab === 'background' && (
                  <motion.div
                    key="background"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                  >
                    <BackgroundPanel 
                      config={state.background} 
                      onChange={(config) => setState(s => ({ ...s, background: config }))} 
                      assets={state.assets}
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
                  >
                    <TransitionPanel onAutoSync={handleAutoSyncTransitions} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              multiple 
              accept="video/*,audio/*,image/*" 
              className="hidden" 
            />
          </div>
          
          <div className="h-36 rounded-lg border p-3 flex flex-col" style={{ backgroundColor: THEME.card, borderColor: THEME.border }} title="Information overview for the current project.">
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
                  isCropping={showCropTool}
                  background={state.background}
                  transitions={state.transitions}
                />
                
                {showCropTool && (
                  <CropTool 
                    onCropChange={() => {}} 
                    onApply={handleApplyCrop}
                    onCancel={() => setShowCropTool(false)}
                    initialCrop={(() => {
                      const c = state.clips.find(clip => clip.id === state.selectedClipId);
                      if (!c || !c.transform.crop) return undefined;
                      const S = c.transform.scale || 1;
                      return {
                        x: 0.5 + (c.transform.crop.x - 0.5) * S,
                        y: 0.5 + (c.transform.crop.y - 0.5) * S,
                        width: c.transform.crop.width * S,
                        height: c.transform.crop.height * S,
                      };
                    })()}
                  />
                )}
              </div>
            </div>

            {/* Preview Controls Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-6 py-2 rounded-full border border-white/10 flex items-center gap-8 shadow-2xl">
              <span className="text-xs font-mono tabular-nums tracking-tighter text-blue-400" title="Current Playhead Time">{formatTime(state.currentTime)}</span>
              <div className="flex items-center gap-6">
                <button title="Step backward 1 second" className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.max(0, s.currentTime - 1)}))}><SkipBack className="h-4 w-4" /></button>
                <button 
                  onClick={() => setState(s => ({ ...s, isPlaying: !s.isPlaying }))}
                  title={state.isPlaying ? "Pause (Space)" : "Play (Space)"}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform active:scale-90 hover:scale-110"
                >
                  {state.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current translate-x-0.5" />}
                </button>
                <button title="Step forward 1 second" className="opacity-40 hover:opacity-100 transition-opacity" onClick={() => setState(s => ({...s, currentTime: Math.min(s.duration, s.currentTime + 1)}))}><SkipForward className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-3">
                <button title="Toggle Crop Mode for selected clip" className={cn("opacity-40 hover:opacity-100 transition-opacity", showCropTool && "opacity-100 text-blue-500")} onClick={() => setShowCropTool(!showCropTool)}><CropIcon className="h-4 w-4" /></button>
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest pl-2 border-l border-white/10" title="Preview Resolution Quality">1/4 Res</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Inspector (Contextual Focus) */}
        <section className="w-72 flex flex-col gap-2">
          <div className="rounded-lg border p-4 flex flex-col h-full overflow-hidden" style={{ backgroundColor: THEME.card, borderColor: THEME.border }}>
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4 shrink-0">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                 <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white" title={`Active Tab: ${activeTab}`}>
                   {activeTab === "export" ? "APNG Optimizer" : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Controls`}
                 </h2>
               </div>
               {activeTab !== "export" && state.selectedClipId && (
                 <button
                   title={`Reset ${activeTab} settings to default`}
                   onClick={handleResetTab}
                   className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                 >
                   <RefreshCw className="h-3 w-3" />
                 </button>
               )}
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
              title="Split selected track at playhead"
              className={cn(
                "w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 active:scale-95 transition-all",
                !state.selectedClipId && "opacity-30 cursor-not-allowed"
              )}
            >
              <Scissor className="h-4 w-4" />
            </button>
            <button 
              title="Merge tracks (Coming soon)"
              className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-sm shadow-lg shadow-blue-600/20 active:scale-90 transition-all pointer-events-none opacity-50"
            >
              <Combine className="h-4 w-4" />
            </button>
            <button 
              title="Add text track (Coming soon)"
              className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-bold border border-white/5 hover:bg-gray-700 transition-all cursor-not-allowed opacity-50"
            >
              T
            </button>
            <button 
              onClick={() => setSnapEnabled(!snapEnabled)}
              title={snapEnabled ? "Disable Sequence Snapping" : "Enable Sequence Snapping"}
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
              title="Undo last action"
              disabled={history.undo.length === 0}
              className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 disabled:opacity-20 transition-all"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-3 bg-black/40 h-8 px-3 rounded-lg border border-white/5" title="Adjust the zoom level to view tracks closer">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Zoom</span>
            <input 
              type="range" min="10" max="300" value={state.zoomLevel}
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
            {/* Timeline Ruler */}
            <div className="relative h-6 flex items-center border-b border-white/[0.05] w-max min-w-full">
              <div 
                className="w-32 sticky left-0 h-full flex items-center px-4 text-[9px] uppercase font-bold text-gray-500 border-r border-white/5 bg-[#121212] z-[60] shrink-0"
              >
                Timecode
              </div>
              <div 
                className="relative h-full" 
                style={{ width: Math.max(3000, state.duration * state.zoomLevel) + 200 }}
              >
                {Array.from({ length: Math.ceil(state.duration) }).map((_, i) => (
                  <div key={i} className="absolute top-0 flex flex-col h-full pointer-events-none" style={{ left: i * state.zoomLevel }}>
                    <div className={cn("w-px bg-white/20 mt-auto", i % 5 === 0 ? "h-2" : "h-1")}></div>
                    {i % 5 === 0 && <span className="absolute -top-[2px] left-1 text-[9px] text-gray-500 font-mono select-none">{formatTime(i)}</span>}
                  </div>
                ))}
              </div>
            </div>

            <Track 
              label="Video 1" 
              icon={<Video />} 
              clips={state.clips.filter(c => c.trackIndex === 0)} 
              transitions={state.transitions}
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
              transitions={state.transitions}
              zoom={state.zoomLevel} 
              onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
              onSelect={(id: string) => setState(s => ({...s, selectedClipId: id}))}
              onMove={updateClipPosition}
              onTrim={updateClipDuration}
              selectedId={state.selectedClipId}
              onContextMenu={handleContextMenu}
            />
            <Track 
              label="Music" 
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
            <Track 
              label="Voice" 
              icon={<Zap />} 
              clips={state.clips.filter(c => c.trackIndex === 3)} 
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

      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8"
          >
            <div className="w-full max-w-md space-y-8 text-center">
              <div className="relative inline-block">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center rotate-45 shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white uppercase tracking-[0.3em]">Processing Render</h2>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest opacity-50">Stitching frames • Encoding {videoExportConfig.quality} resolution</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 px-1">
                  <span>Rendering Pipeline</span>
                  <span className="tabular-nums text-blue-400">{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                  />
                </div>
                <div className="flex justify-center pt-2">
                   <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-tighter">Do not close this tab until download begins</span>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Export Modal */}
      <AnimatePresence>
        {showVideoExportModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowVideoExportModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#161616] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative"
            >
              <button 
                onClick={() => setShowVideoExportModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
                title="Close"
              >
                &times;
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest">Export Video</h2>
                  <p className="text-xs text-gray-500 font-mono">Render timeline to WebM</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="space-y-2 relative" title="Determines the final dimensions (width/height) of the exported video file.">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Resolution Preset</label>
                  <select 
                    value={videoExportConfig.quality}
                    onChange={(e) => setVideoExportConfig(prev => ({ ...prev, quality: e.target.value }))}
                    className="w-full bg-[#0A0A0A] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value="4k">4K Ultra HD (3840x2160)</option>
                    <option value="1080p">1080p Full HD (1920x1080)</option>
                    <option value="720p">720p HD (1280x720)</option>
                  </select>
                </div>

                <div className="space-y-2 relative" title="The number of frames rendered per second. Higher means smoother motion but a larger file size.">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Framerate (FPS)</label>
                  <select 
                    value={videoExportConfig.fps}
                    onChange={(e) => setVideoExportConfig(prev => ({ ...prev, fps: Number(e.target.value) }))}
                    className="w-full bg-[#0A0A0A] border border-white/5 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    <option value={0}>Auto (Match Original / 60 FPS)</option>
                    <option value={120}>120 FPS (Ultra Smooth / Pro)</option>
                    <option value={90}>90 FPS (High Performance)</option>
                    <option value={60}>60 FPS (Standard)</option>
                    <option value={30}>30 FPS (Classic TV)</option>
                    <option value={24}>24 FPS (Cinematic / Film)</option>
                    <option value={15}>15 FPS (Lo-fi / Animated GIF style)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={handleExportVideo}
                  disabled={state.clips.length === 0}
                  title="Begin rendering and exporting your timeline into a WebM video file"
                  className={cn(
                    "w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[11px] transition-all",
                    state.clips.length === 0 
                      ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                  )}
                >
                  <Download className="w-4 h-4" />
                  Start Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

function Track({ label, icon, clips, zoom, transitions = [], onSeek, onSelect, onMove, onTrim, selectedId, onContextMenu }: any) {
  return (
    <div className="relative h-14 flex bg-white/[0.02] border-b border-white/[0.05] min-w-max group overflow-hidden">
      <div 
        className="w-32 sticky left-0 h-full flex items-center px-4 text-[10px] uppercase font-bold text-gray-500 border-r border-white/10 bg-[#0A0A0A] z-[60] shrink-0 shadow-[4px_0_10px_rgba(0,0,0,0.5)]"
        title={`Timeline track: ${label}`}
      >
        <div className="flex items-center gap-2">
          {React.cloneElement(icon, { size: 14, className: "opacity-40" })}
          <span className="tracking-widest">{label}</span>
        </div>
      </div>
      <div className="relative flex-1 min-w-[5000px] h-full p-1.5">
        {/* Clips Rendering */}
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
              "absolute h-10 top-2 rounded-md border flex items-start pt-1 px-1 cursor-grab overflow-hidden active:cursor-grabbing shadow-lg group/clip text-white",
              selectedId === c.id ? "ring-2 ring-white/50 z-20 shadow-2xl" : "z-10",
              label === "Video 1" ? (selectedId === c.id ? "bg-blue-500/40 border-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20") :
              label === "Overlay" ? (selectedId === c.id ? "bg-purple-500/40 border-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]" : "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20") :
              (selectedId === c.id ? "bg-emerald-500/40 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-emerald-600/10 border-emerald-500/30 hover:bg-emerald-600/20")
            )}
            style={{ left: c.startTime * zoom, width: (c.duration) * zoom }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.id);
            }}
            title={`Clip: ${c.name} \nDuration: ${formatTime(c.duration)}`}
          >
            {/* Frame by Frame / Filmstrip */}
            {c.type === 'video' && (
              <Filmstrip 
                url={c.url} 
                duration={c.duration} 
                zoom={zoom} 
                sourceStart={c.sourceStart} 
                sourceEnd={c.sourceEnd} 
              />
            )}

            {/* Audio Waveform */}
            {(c.type === 'audio' || c.type === 'video') && c.audio?.waveform && (
              <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <AudioWaveform data={c.audio.waveform} color={c.type === 'audio' ? "#10B981" : "#3B82F6"} />
              </div>
            )}

            {/* Content info */}
            <div className="z-10 flex items-center gap-1.5 truncate pointer-events-none">
               <span className="text-[8px] font-bold opacity-70 uppercase tracking-tighter truncate">{c.name}</span>
            </div>
            
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
          </motion.div>
        ))}

        {/* Transitions Rendering */}
        {transitions?.map((t: any) => {
          const fromClip = clips.find((c: any) => c.id === t.fromClipId);
          const toClip = clips.find((c: any) => c.id === t.toClipId);
          if (!fromClip || !toClip) return null;
          
          const junction = fromClip.startTime + fromClip.duration;
          const start = junction - t.duration / 2;
          
          return (
            <div 
              key={t.id}
              className="absolute h-full top-0 bg-blue-500/30 border-x border-blue-400 group/transition cursor-pointer hover:bg-blue-500/50 transition-all z-[25] flex items-center justify-center backdrop-blur-[2px]"
              style={{ left: start * zoom, width: t.duration * zoom }}
              title={`Transition: ${t.type}\nDouble click to remove`}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onContextMenu(e, t.id, 'transition');
              }}
            >
               <div className="w-[1.5px] h-3 bg-white/60 rounded-full" />
               <div className="absolute inset-x-0 bottom-0 py-0.5 bg-blue-600/60 opacity-0 group-hover/transition:opacity-100 transition-opacity">
                 <p className="text-[6px] font-bold text-center text-white scale-75 uppercase truncate">{t.type}</p>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContextItem({ label, tooltip, icon, onClick, danger, disabled }: any) {
  return (
    <button 
      disabled={disabled}
      title={tooltip || label}
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
