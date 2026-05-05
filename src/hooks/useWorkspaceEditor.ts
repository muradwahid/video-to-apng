import React, { useState, useRef, useEffect, useCallback } from "react";
import { TimelineState, APNGOptions, MediaAsset, VideoClip } from "@/src/types";
import { EFFECT_DEFS } from "@/src/lib/effectsDefs";
import { formatTime } from "@/src/lib/utils";
import { audioEngine } from "@/src/services/audioEngine";
import { renderBackground, renderClip, renderClipWithTransition } from "@/src/lib/renderer";
import UPNG from "upng-js";
import * as WebMMuxer from 'webm-muxer';

export function useWorkspaceEditor() {
  const [state, setState] = useState<TimelineState>({
    clips: [],
    assets: [],
    currentTime: 0,
    duration: 30, // Default 30s timeline
    isPlaying: false,
    playbackSpeed: 1,
    toolMode: 'selection',
    selectedClipId: null,
    selectedClipIds: [],
    selectedTransitionId: null,
    zoomLevel: 100, // pixels per second
    background: {
      type: 'solid',
      color: '#000000',
      opacity: 1,
      blurIntensity: 0,
      fit: 'cover'
    },
    transitions: [],
    markers: [],
    useProxies: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"media" | "effects" | "color" | "audio" | "export" | "graphics" | "captions">("media");
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

  const [sidebarTab, setSidebarTab] = useState<"assets" | "templates" | "background" | "transitions" | "sequence">("assets");
  const [assetSearch, setAssetSearch] = useState("");

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

  const handleFocusSelected = () => {
    if (!state.selectedClipId || !timelineRef.current) return;
    const clip = (state.clips || []).find(c => c.id === state.selectedClipId);
    if (clip) {
      const x = clip.startTime * state.zoomLevel;
      timelineRef.current.scrollTo({
        left: x,
        behavior: 'smooth'
      });
    }
  };

  const handleSelectClip = useCallback((id: string, toggleMulti: boolean, event?: MouseEvent) => {
    setState(prev => {
      const clip = prev.clips.find(c => c.id === id);
      if (!clip) return prev;

      if (prev.toolMode === 'razor' && event && timelineRef.current) {
        // Handle cutting at mouse cursor!
        const scrollLeft = timelineRef.current.scrollLeft;
        const mouseX = event.clientX - timelineRef.current.getBoundingClientRect().left + scrollLeft - 128 - 24; // approx padding
        const splitTime = Math.max(0, mouseX / prev.zoomLevel);

        if (clip.locked) return prev;

        const splitOffset = splitTime - clip.startTime;
        if (splitOffset <= 0.1 || (clip.duration - splitOffset) <= 0.1) {
          return prev; // Too close to edge
        }

        const clipA: VideoClip = {
          ...clip,
          duration: splitOffset,
          sourceEnd: clip.sourceStart + splitOffset
        };

        const clipB: VideoClip = {
          ...clip,
          id: Math.random().toString(36).substr(2, 9),
          startTime: splitTime,
          duration: clip.duration - splitOffset,
          sourceStart: clip.sourceStart + splitOffset
        };

        const newClips = (prev.clips || []).filter(c => c.id !== id);
        newClips.push(clipA, clipB);
        return { ...prev, clips: newClips, selectedClipIds: [clipB.id], selectedClipId: clipB.id };
      }
      
      let newSelectedIds = [...prev.selectedClipIds];
      
      // If we clicked a grouped clip, select all clips in the group
      let idsToSelect = [id];
      if (clip.groupId) {
        idsToSelect = (prev.clips || []).filter(c => c.groupId === clip.groupId).map(c => c.id);
      }

      if (toggleMulti) {
        const allSelected = idsToSelect.every(cid => newSelectedIds.includes(cid));
        if (allSelected) {
          newSelectedIds = newSelectedIds.filter(cid => !idsToSelect.includes(cid));
        } else {
          idsToSelect.forEach(cid => {
            if (!newSelectedIds.includes(cid)) newSelectedIds.push(cid);
          });
        }
      } else {
        newSelectedIds = [...idsToSelect];
      }

      return {
        ...prev,
        selectedClipIds: newSelectedIds,
        selectedTransitionId: null,
        selectedClipId: newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null
      };
    });
  }, []);

  const handleSelectTransition = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      selectedClipIds: [],
      selectedClipId: null,
      selectedTransitionId: id
    }));
  }, []);

  const updateClipPosition = useCallback((id: string, newStartTime: number, deltaY: number = 0) => {
    setState(prev => {
      const clip = prev.clips.find(c => c.id === id);
      if (clip?.locked) return prev;

      let t = Math.max(0, newStartTime);
      let newTrackIndex = clip?.trackIndex ?? 0;
      
      if (deltaY !== 0) {
        const trackJump = Math.round(deltaY / 56);
        newTrackIndex = Math.max(0, Math.min(3, newTrackIndex + trackJump));
      }
      
      const clipDuration = prev.clips.find(c => c.id === id)?.duration || 0;

      if (snapEnabled) {
        const targetTracks = [newTrackIndex - 1, newTrackIndex, newTrackIndex + 1];
        const relevantClips = (prev.clips || []).filter(c => c.id !== id && targetTracks.includes(c.trackIndex ?? 0));
        
        const snapPoints = [
          0,
          prev.currentTime,
          ...relevantClips.map(c => c.startTime),
          ...relevantClips.map(c => c.startTime + c.duration)
        ];

        let bestSnapDist = 15 / prev.zoomLevel; // 15 pixels threshold
        let newT = t;

        for (const p of snapPoints) {
          if (Math.abs(p - t) < bestSnapDist) {
            bestSnapDist = Math.abs(p - t);
            newT = p;
          }
          if (Math.abs(p - (t + clipDuration)) < bestSnapDist) {
            bestSnapDist = Math.abs(p - (t + clipDuration));
            newT = p - clipDuration;
          }
        }
        t = Math.max(0, newT);
      }
      
      const deltaX = t - clip.startTime;
      const actualTrackJump = newTrackIndex - (clip.trackIndex ?? 0);

      if (prev.toolMode === 'slip') {
         const rawDeltaX = newStartTime - clip.startTime; // Use non-snapped delta for slip
         const newSourceStart = Math.max(0, (clip.sourceStart ?? 0) - rawDeltaX);
         return {
           ...prev,
           clips: prev.clips.map(c => c.id === id ? { ...c, sourceStart: newSourceStart } : c)
         };
      }

      if (prev.toolMode === 'slide') {
         const previousClip = prev.clips.find(c => Math.abs((c.startTime + c.duration) - clip.startTime) < 0.1 && c.trackIndex === clip.trackIndex);
         const nextClip = prev.clips.find(c => Math.abs(c.startTime - (clip.startTime + clip.duration)) < 0.1 && c.trackIndex === clip.trackIndex);

         return {
           ...prev,
           clips: prev.clips.map(c => {
             if (c.id === id) {
               return { ...c, startTime: Math.max(0, clip.startTime + deltaX) };
             }
             if (previousClip && c.id === previousClip.id) {
               return { ...c, duration: Math.max(0.1, c.duration + deltaX) };
             }
             if (nextClip && c.id === nextClip.id) {
               return { 
                 ...c, 
                 startTime: Math.max(0, c.startTime + deltaX),
                 sourceStart: Math.max(0, (c.sourceStart ?? 0) + deltaX),
                 duration: Math.max(0.1, c.duration - deltaX)
               };
             }
             return c;
           }),
           duration: Math.max(prev.duration, t + clipDuration + 5)
         };
      }

      return {
        ...prev,
        clips: prev.clips.map(c => {
          if (c.id === id) {
            return { ...c, startTime: t, trackIndex: newTrackIndex };
          }
          if (clip.groupId && c.groupId === clip.groupId) {
             return { 
               ...c, 
               startTime: Math.max(0, c.startTime + deltaX), 
               trackIndex: Math.max(0, Math.min(3, (c.trackIndex ?? 0) + actualTrackJump)) 
             };
          }
          return c;
        }),
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
      if (!clip || clip.locked) return prev;

      // Check if current time is within clip
      if (prev.currentTime <= clip.startTime || prev.currentTime >= clip.startTime + clip.duration) {
        alert("Playhead must be inside the clip to split.");
        return prev;
      }

      // Snap to exact frame (assuming 30fps)
      const exactFrameTime = Math.round(prev.currentTime * 30) / 30;
      const splitOffset = exactFrameTime - clip.startTime;
      
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
        clips: [...(prev.clips || []).filter(c => c.id !== clip.id), clipA, clipB],
        selectedClipId: clipB.id,
        duration: Math.max(prev.duration, clipB.startTime + clipB.duration + 5)
      };
    });
    closeContextMenu();
  }, [closeContextMenu]);

  const duplicateClip = useCallback((id?: string) => {
    setState(prev => {
      const idToClone = id || prev.selectedClipId;
      if (!idToClone) return prev;
      const clip = prev.clips.find(c => c.id === idToClone);
      if (!clip) return prev;

      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      const clone = {
        ...JSON.parse(JSON.stringify(clip)),
        id: Math.random().toString(36).substring(2, 11),
        startTime: clip.startTime + clip.duration,
        name: `${clip.name} (Copy)`
      };
      
      const newClips = [...prev.clips, clone];
      return {
        ...prev,
        clips: newClips,
        selectedClipId: clone.id,
        duration: Math.max(prev.duration, clone.startTime + clone.duration + 5)
      };
    });
    closeContextMenu();
  }, [closeContextMenu]);

  const moveClipTrack = useCallback((id: string, delta: number) => {
    setState(prev => {
      const clip = prev.clips.find(c => c.id === id);
      if (!clip) return prev;
      if (clip.locked) return prev;

      const newTrackIndex = clip.trackIndex + delta;
      if (newTrackIndex < 0 || newTrackIndex > 3) return prev;

      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      return {
        ...prev,
        clips: prev.clips.map(c => c.id === id ? { ...c, trackIndex: newTrackIndex } : c)
      };
    });
    closeContextMenu();
  }, [closeContextMenu]);

  const removeClip = useCallback((id?: string) => {
    setState(prev => {
      const idToRemove = id || prev.selectedClipId;
      if (!idToRemove) return prev;

      const clip = prev.clips.find(c => c.id === idToRemove);
      if (clip?.locked) return prev;

      // Push history with the state BEFORE filtering
      setHistory(hPrev => ({
        undo: [JSON.parse(JSON.stringify(prev)), ...hPrev.undo].slice(0, 50),
        redo: []
      }));

      return {
        ...prev,
        clips: (prev.clips || []).filter(c => c.id !== idToRemove),
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

  const handleGroupClips = useCallback(() => {
    setState(prev => {
      if (prev.selectedClipIds.length < 2) return prev;
      const groupId = Math.random().toString(36).substring(2, 9);
      const newClips = prev.clips.map(c => {
        if (prev.selectedClipIds.includes(c.id)) {
          return { ...c, groupId };
        }
        return c;
      });
      return { ...prev, clips: newClips };
    });
  }, []);

  const handleUngroupClips = useCallback(() => {
    setState(prev => {
      const selectedClips = (prev.clips || []).filter(c => prev.selectedClipIds.includes(c.id));
      const groupIdsToRemove = new Set(selectedClips.map(c => c.groupId).filter(Boolean));
      if (groupIdsToRemove.size === 0) return prev;
      
      const newClips = prev.clips.map(c => {
        if (c.groupId && groupIdsToRemove.has(c.groupId)) {
          const { groupId, ...rest } = c;
          return rest as any;
        }
        return c;
      });
      return { ...prev, clips: newClips };
    });
  }, []);

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
        case "k":
          e.preventDefault();
          const hasContent = (state.clips || []).length > 0 || state.background.type !== 'solid' || state.background.color !== '#000000';
          if (hasContent) {
            setState(s => ({ ...s, isPlaying: !s.isPlaying }));
          }
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          setState(s => ({ ...s, currentTime: Math.max(0, s.currentTime - 1/30) }));
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          setState(s => ({ ...s, currentTime: Math.min(s.duration, s.currentTime + 1/30) }));
          break;
        case "home":
          e.preventDefault();
          setState(s => ({ ...s, currentTime: 0 }));
          break;
        case "end":
          e.preventDefault();
          setState(s => ({ ...s, currentTime: s.duration }));
          break;
        case "v":
          setState(s => ({ ...s, toolMode: 'selection' }));
          break;
        case "b":
          setState(s => ({ ...s, toolMode: 'ripple' }));
          break;
        case "n":
          setState(s => ({ ...s, toolMode: 'roll' }));
          break;
        case "r":
          setState(s => ({ ...s, toolMode: 'rateStretch' }));
          break;
        case "y":
          setState(s => ({ ...s, toolMode: 'slip' }));
          break;
        case "u":
          setState(s => ({ ...s, toolMode: 'slide' }));
          break;
        case "c":
          setState(s => ({ ...s, toolMode: 'razor' }));
          break;
        case "s":
          handleSplit();
          break;
        case "m":
          e.preventDefault();
          setState(s => ({
            ...s,
            markers: [
              ...(s.markers || []),
              {
                id: Math.random().toString(36).substr(2, 9),
                time: Math.round(s.currentTime * 100) / 100,
                name: `Marker ${ (s.markers?.length || 0) + 1 }`,
                color: '#2563EB',
                notes: ''
              }
            ]
          }));
          break;
        case "g":
          handleGroupClips();
          break;
        case "u":
          handleUngroupClips();
          break;
        case "delete":
        case "backspace":
          if (state.selectedClipIds.length > 0) {
            state.selectedClipIds.forEach(id => removeClip(id));
          } else if (state.selectedClipId) {
            removeClip(state.selectedClipId);
          } else if (state.selectedTransitionId) {
             setState(prev => ({ ...prev, transitions: (prev.transitions || []).filter(t => t.id !== state.selectedTransitionId), selectedTransitionId: null }));
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
  
  return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.selectedClipId, state.currentTime, handleSplit, removeClip, handleGroupClips, handleUngroupClips]);

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
        const nextTime = prev.currentTime + (deltaTime * prev.playbackSpeed);
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
      (state.clips || []).forEach(clip => {
        if (clip.type === 'video' || clip.type === 'audio') {
          audioEngine.playClip(clip, state.currentTime, true).catch(console.error);
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
    if ((state.clips || []).length === 0) return;
    
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

      const minStartTime = (state.clips || []).length > 0 ? Math.min(...(state.clips || []).map(c => c.startTime)) : 0;
      const maxEndTime = (state.clips || []).length > 0 ? Math.max(...(state.clips || []).map(c => c.startTime + c.duration)) : 0;
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
      const uniqueUrls = Array.from(new Set((state.clips || []).map(c => c.url))).filter(Boolean);
      const uniqueMedia = uniqueUrls.map(url => {
        const clip = (state.clips || []).find(c => c.url === url)!;
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
        return new Promise<void>((resolve) => {
          if (item.type === 'video') {
            const vid = document.createElement('video');
            vid.src = item.url;
            vid.crossOrigin = "anonymous";
            vid.muted = true;
            vid.preload = "auto";
            vid.onloadeddata = () => { mediaElements[item.url] = vid; resolve(); };
            vid.onerror = () => { console.warn(`Failed to load video: ${item.name}`); resolve(); }
            setTimeout(() => { if (!mediaElements[item.url]) { console.warn(`Timeout loading: ${item.name}`); resolve(); } }, 15000);
          } else if (item.type === 'image') {
            const img = new Image();
            img.src = item.url;
            img.crossOrigin = "anonymous";
            img.onload = () => { mediaElements[item.url] = img; resolve(); };
            img.onerror = () => { console.warn(`Failed to load image: ${item.name}`); resolve(); };
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

        const activeTransition = (state.transitions || []).find(t => {
          const fromClip = (state.clips || []).find(c => c.id === t.fromClipId);
          if (!fromClip) return false;
          const junction = fromClip.startTime + fromClip.duration;
          return absoluteTime >= junction - t.duration / 2 && absoluteTime <= junction + t.duration / 2;
        });

        if (activeTransition) {
          const fromClip = (state.clips || []).find(c => c.id === activeTransition.fromClipId)!;
          const toClip = (state.clips || []).find(c => c.id === activeTransition.toClipId)!;
          const junction = fromClip.startTime + fromClip.duration;
          const progress = (absoluteTime - (junction - activeTransition.duration / 2)) / activeTransition.duration;

          await Promise.all([fromClip, toClip].map(async (clip) => {
            const media = mediaElements[clip.url];
            if (clip.type === 'video' && media instanceof HTMLVideoElement) {
              const relativeTime = (absoluteTime - clip.startTime) * (clip.speed || 1) + clip.sourceStart;
              await seekVideo(media, Math.min(relativeTime, media.duration - 0.05));
            }
          }));

          renderClipWithTransition(ctx, width, height, fromClip, toClip, activeTransition.type, progress, mediaElements, absoluteTime);
        } else {
          const activeClips = (state.clips || [])
            .filter(c => absoluteTime >= c.startTime && absoluteTime < (c.startTime + c.duration))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));
          
          for (const clip of activeClips) {
            const media = mediaElements[clip.url];
            if (clip.type === 'video' && media instanceof HTMLVideoElement) {
              const relativeTime = (absoluteTime - clip.startTime) * (clip.speed || 1) + clip.sourceStart;
              await seekVideo(media, Math.min(relativeTime, media.duration - 0.05));
            }
            renderClip(ctx, width, height, clip, mediaElements, absoluteTime);
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
    if ((state.clips || []).length === 0) {
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
      const minStartTime = Math.min(...(state.clips || []).map(c => c.startTime));
      const maxEndTime = Math.max(...(state.clips || []).map(c => c.startTime + c.duration));
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
      const urls = Array.from(new Set((state.clips || []).map(c => c.url))).filter(Boolean);
      const mediaElements: { [url: string]: HTMLVideoElement | HTMLImageElement } = {};
      
      await Promise.all(urls.map((url: string) => {
        const clip = (state.clips || []).find(c => c.url === url);
        return new Promise<void>((resolve) => {
          if (clip?.type === 'video') {
            const v = document.createElement('video');
            v.src = url;
            v.muted = true;
            v.preload = "auto";
            v.crossOrigin = "anonymous";
            v.onloadedmetadata = () => resolve();
            v.onerror = () => resolve();
            mediaElements[url] = v;
          } else {
            const img = new Image();
            img.src = url;
            img.crossOrigin = "anonymous";
            img.onload = () => resolve();
            img.onerror = () => resolve();
            mediaElements[url] = img;
          }
        });
      }));

      const renderFrameAtTime = async (time: number, absoluteTime: number) => {
        // Solid black background prevents "transparency blinks" at loop points or between clips
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        const activeClips = (state.clips || []).filter(c => absoluteTime >= c.startTime && absoluteTime < c.startTime + c.duration);
        
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
      media.preload = 'metadata';
      media.onloadedmetadata = () => resolve(media.duration);
      media.onerror = () => resolve(5); // fallback
      media.src = url;
      media.load();
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
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

        // Detect RAW/Log formats (mock)
        const ext = file.name.split('.').pop()?.toLowerCase();
        let colorSpace: any = 'rec709';
        if (file.name.toLowerCase().includes('slog')) colorSpace = 'slog2';
        else if (file.name.toLowerCase().includes('vlog')) colorSpace = 'vlog';
        else if (file.name.toLowerCase().includes('clog')) colorSpace = 'clog';
        else if (ext === 'nef' || ext === 'nrw' || ext === 'crm' || ext === 'mxf') colorSpace = 'auto';

        return {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url,
          type,
          size: file.size,
          duration,
          audioWaveform: waveform,
          proxyStatus: type === 'video' ? 'generating' : undefined,
          sourceSettings: {
             colorSpace,
             gammaCurve: 'standard',
             whiteBalance: 5600
          },
          metadata: {
             codec: type === 'video' ? (ext === 'mkv' ? 'H.264/AAC' : 'H.265/HEVC') : undefined,
             resolution: type === 'video' ? '1920x1080' : undefined,
             fps: type === 'video' ? 60 : undefined,
             colorSpace,
             bitDepth: (ext === 'nef' || ext === 'crm' || ext === 'mxf') ? 10 : 8,
             fileSize: file.size,
             creationDate: new Date().toISOString()
          }
        } as MediaAsset;
      });

      let newAssets;
      try {
         newAssets = await Promise.all(newAssetsPromises);
      } catch (err) {
         console.error("Asset import error", err);
         return;
      }

      setState(prev => {
         const nextState = {
           ...prev,
           assets: [...(prev.assets || []), ...newAssets],
         };
         return nextState;
      });

      // Start proxy generation asynchronously
      newAssets.forEach(async (asset) => {
         if (asset.type === 'video' && asset.proxyStatus === 'generating') {
            try {
               // We dynamically import to avoid breaking components if it isn't ready
               const { generateProxy } = await import('@/src/lib/proxyManager');
               const proxyUrl = await generateProxy(asset.id, asset.url, (p) => console.log('Proxy progress', p));
               setState(s => ({
                  ...s,
                  assets: s.assets.map(a => a.id === asset.id ? { ...a, proxyUrl, proxyStatus: 'ready' } : a)
               }));
            } catch(e) {
               console.error("Proxy gen failed", e);
               setState(s => ({
                  ...s,
                  assets: s.assets.map(a => a.id === asset.id ? { ...a, proxyStatus: 'failed' } : a)
               }));
            }
         }
      });
    } catch (e) {
      console.error("handleFileUpload error:", e);
    }
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
    const effectType = e.dataTransfer.getData("application/effect-type");
    const motionType = e.dataTransfer.getData("application/motion-type");
    const assetData = e.dataTransfer.getData("asset");

    if (motionType && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 128 - 8;
      const dropTime = Math.max(0, x / state.zoomLevel);
      
      const hoverClips = (state.clips || []).filter(c => dropTime >= c.startTime && dropTime <= c.startTime + c.duration);
      if (hoverClips.length > 0) {
        const clipToUpdate = hoverClips.sort((a,b) => b.trackIndex - a.trackIndex)[0];
        
        setState(prev => {
          return {
            ...prev,
            clips: prev.clips.map(c => {
               if (c.id === clipToUpdate.id) {
                  let kfs = c.keyframes || [];
                  const t = dropTime - c.startTime;
                  
                  if (motionType === 'fly-in') {
                    kfs = [...kfs, { id: Math.random().toString(36).substr(2), time: t, properties: { y: 1080 }, easing: 'ease-out' }, { id: Math.random().toString(36).substr(2), time: t + 1, properties: { y: 0 }, easing: 'linear' }];
                  } else if (motionType === 'fade-in') {
                    kfs = [...kfs, { id: Math.random().toString(36).substr(2), time: t, properties: { opacity: 0 }, easing: 'ease-out' }, { id: Math.random().toString(36).substr(2), time: t + 0.5, properties: { opacity: 1 }, easing: 'linear' }];
                  } else if (motionType === 'scale-up') {
                    kfs = [...kfs, { id: Math.random().toString(36).substr(2), time: t, properties: { scale: 0 }, easing: 'ease-out' }, { id: Math.random().toString(36).substr(2), time: t + 0.5, properties: { scale: 1 }, easing: 'linear' }];
                  }
                  
                  return { ...c, keyframes: kfs }
               }
               return c;
            })
          }
        });
      }
      return;
    }

    if (effectType && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 128 - 8;
      const y = e.clientY - rect.top - 8;
      
      const dropTime = Math.max(0, x / state.zoomLevel);
      const trackIndex = Math.max(0, Math.min(3, Math.floor(y / 56) - 1)); // -1 for ruler offset roughly. The calculation trackIndex = Math.floor(y/56) is used below too. Let's just use what was below:
      
      const trackI = Math.max(0, Math.min(3, Math.floor((e.clientY - rect.top - 40) / 64))); // Actually Timeline uses height 64 per track and 40 for ruler. Let's be safe.
      // Easiest is to search all clips intersecting time, and pick the one with max z-index or sort by trackIndex.
      const hoverClips = (state.clips || []).filter(c => dropTime >= c.startTime && dropTime <= c.startTime + c.duration);
      if (hoverClips.length > 0) {
        // approximate by track by grabbing first
        const clipToUpdate = hoverClips.sort((a,b) => b.trackIndex - a.trackIndex)[0];
        
        const def = EFFECT_DEFS.find(d => d.id === effectType);
        const defaultParams = def ? { ...def.defaultParams } : {};
        
        setState(prev => {
          return {
            ...prev,
            clips: prev.clips.map(c => {
               if (c.id === clipToUpdate.id) {
                  return {
                    ...c,
                    effects: [...(c.effects || []), { id: Math.random().toString(36).substr(2, 9), type: effectType, enabled: true, params: defaultParams }]
                  }
               }
               return c;
            })
          }
        });
      }
      return;
    }

    if (transitionType && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 128 - 8;
      const dropTime = Math.max(0, x / state.zoomLevel);
      
      // Find clips that are adjacent or overlapping at the drop point
      // We look for a junction point (end of one, start of another)
      const fromClip = (state.clips || []).find(c => Math.abs((c.startTime + c.duration) - dropTime) < 0.5);
      const toClip = (state.clips || []).find(c => Math.abs(c.startTime - dropTime) < 0.5);
      
      if (fromClip && toClip && fromClip.id !== toClip.id) {
        // Remove any existing transition between these two clips
        const filteredTransitions = (state.transitions || []).filter(t => 
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
    const trackIndex = Math.max(0, Math.min(3, Math.floor(y / 56))); // Track is ~56px height

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
      assets: (prev.assets || []).filter(a => a.id !== id),
      clips: (prev.clips || []).filter(c => !prev.assets.find(a => a.id === id && a.url === c.url))
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
    const track0Clips = [...(state.clips || [])]
      .filter(c => c.trackIndex === 0)
      .sort((a, b) => a.startTime - b.startTime);
    
    if (track0Clips.length < 2) return;
    
    const newTransitions: any[] = [...(state.transitions || [])];
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
          // Un-apply the scale and position so the screen crop dimensions map relative to the intrinsic source
          const S = c.transform.scale || 1;
          const tx = (c.transform.x || 0) / 1920; // use fixed resolution base
          const ty = (c.transform.y || 0) / 1080;
          
          let newX = 0.5 + (crop.x - 0.5 - tx) / S;
          let newY = 0.5 + (crop.y - 0.5 - ty) / S;
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
      setState(prev => {
         // if targetId is already in selectedClipIds, we don't clear the array,
         // otherwise we select only this one clip
         if (!prev.selectedClipIds.includes(targetId)) {
           return { ...prev, selectedClipId: targetId, selectedClipIds: [targetId], selectedTransitionId: null };
         }
         return prev; // It's already mostly selected
      });
    } else if (targetId && type === 'transition') {
      setState(prev => ({ ...prev, selectedTransitionId: targetId, selectedClipId: null, selectedClipIds: [] }));
    }
    
    let estimatedHeight = 100;
    if (type === 'transition') {
      estimatedHeight = 50;
    } else if (targetId) {
      estimatedHeight = 320; // max ~8 items * 36px + padding
    } else {
      estimatedHeight = 150; // 3 items
    }

    let y = e.clientY;
    let x = e.clientX;
    if (y + estimatedHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - estimatedHeight - 10);
    }
    if (x + 200 > window.innerWidth) { // ~200px context menu width
      x = Math.max(10, window.innerWidth - 200 - 10);
    }
    
    setContextMenu({ x, y, show: true, targetId, type } as any);
  }, []);

  const updateClipDuration = (id: string, delta: number, edge: 'start' | 'end') => {
    setState(prev => {
      const clip = prev.clips.find(c => c.id === id);
      if (clip?.locked) return prev;

      let snapPoints: number[] = [];
      if (snapEnabled) {
        const targetTracks = [
          (clip?.trackIndex ?? 0) - 1, 
          (clip?.trackIndex ?? 0), 
          (clip?.trackIndex ?? 0) + 1
        ];
        const relevantClips = (prev.clips || []).filter(c => c.id !== id && targetTracks.includes(c.trackIndex ?? 0));
        
        snapPoints = [
          prev.currentTime,
          ...relevantClips.map(c => c.startTime),
          ...relevantClips.map(c => c.startTime + c.duration)
        ];
      }

      let maxTime = prev.duration;

      const newClips = prev.clips.map(c => {
        if (c.id !== id) {
          return c;
        }
        let clipUpdates: Partial<VideoClip> = {};
        let finalDelta = 0;

        if (edge === 'start') {
          let newStart = c.startTime + delta;
          let bestSnapDist = 15 / prev.zoomLevel;
          for (const p of snapPoints) {
            if (Math.abs(p - newStart) < bestSnapDist) {
              bestSnapDist = Math.abs(p - newStart);
              newStart = p;
            }
          }
          newStart = Math.max(0, newStart);
          const timeDelta = newStart - c.startTime;
          const newDuration = Math.max(0.1, c.duration - timeDelta);
          const newSourceStart = (c.sourceStart ?? 0) + timeDelta;
          
          clipUpdates = { startTime: newStart, duration: newDuration, sourceStart: newSourceStart };
          finalDelta = timeDelta;
        } else {
          let newEnd = c.startTime + c.duration + delta;
          let bestSnapDist = 15 / prev.zoomLevel;
          for (const p of snapPoints) {
            if (Math.abs(p - newEnd) < bestSnapDist) {
              bestSnapDist = Math.abs(p - newEnd);
              newEnd = p;
            }
          }
          const newDuration = Math.max(0.1, newEnd - c.startTime);
          clipUpdates = { duration: newDuration };
          finalDelta = newDuration - c.duration;
        }
        return { ...c, ...clipUpdates };
      });

      // Apply ripple effect if toolMode is ripple
      let finalClips = newClips;
      const targetClip = newClips.find(c => c.id === id);
      const originalClip = prev.clips.find(c => c.id === id);
      const durationDelta = (targetClip?.duration ?? 0) - (originalClip?.duration ?? 0);
      const timeDelta = (targetClip?.startTime ?? 0) - (originalClip?.startTime ?? 0);

      if (prev.toolMode === 'ripple') {
         const moveDelta = edge === 'start' ? -timeDelta : durationDelta;
         const moveThreshold = edge === 'start' ? (originalClip?.startTime ?? 0) : (originalClip?.startTime ?? 0) + (originalClip?.duration ?? 0);

         finalClips = newClips.map(c => {
            if (c.id === id) {
               if (edge === 'start') {
                  return { ...c, startTime: Math.max(0, c.startTime + moveDelta) };
               }
               return c;
            }
            if (c.startTime >= moveThreshold && c.trackIndex === originalClip?.trackIndex) {
              return { ...c, startTime: Math.max(0, c.startTime + moveDelta) };
            }
            return c;
         });
      } else if (prev.toolMode === 'roll') {
         if (edge === 'start') {
           const origStart = originalClip?.startTime ?? 0;
           const previousClip = prev.clips.find(c => Math.abs((c.startTime + c.duration) - origStart) < 0.1 && c.trackIndex === originalClip?.trackIndex);
           if (previousClip) {
             finalClips = finalClips.map(c => c.id === previousClip.id ? { ...c, duration: Math.max(0.1, c.duration + timeDelta) } : c);
           }
         } else {
           const origEnd = (originalClip?.startTime ?? 0) + (originalClip?.duration ?? 0);
           const nextClip = prev.clips.find(c => Math.abs(c.startTime - origEnd) < 0.1 && c.trackIndex === originalClip?.trackIndex);
           if (nextClip) {
             finalClips = finalClips.map(c => c.id === nextClip.id ? { ...c, startTime: nextClip.startTime + durationDelta, duration: Math.max(0.1, nextClip.duration - durationDelta), sourceStart: (nextClip.sourceStart ?? 0) + durationDelta } : c);
           }
         }
      } else if (prev.toolMode === 'rateStretch') {
         // Revert the sourceStart change made by the default duration logic so speed computation controls what plays
         if (edge === 'start') {
           finalClips = finalClips.map(c => {
             if (c.id === id) {
                const origSpeed = originalClip?.speed ?? 1;
                const origDuration = originalClip?.duration ?? 1;
                const newSpeed = (origDuration * origSpeed) / Math.max(0.1, c.duration);
                // restore original source start because we only stretch it, we don't trim the source
                return { ...c, speed: newSpeed, sourceStart: originalClip?.sourceStart ?? 0 };
             }
             return c;
           });
         } else {
           finalClips = finalClips.map(c => {
             if (c.id === id) {
                const origSpeed = originalClip?.speed ?? 1;
                const origDuration = originalClip?.duration ?? 1;
                const newSpeed = (origDuration * origSpeed) / Math.max(0.1, c.duration);
                return { ...c, speed: newSpeed };
             }
             return c;
           });
         }
      }

      maxTime = prev.duration;
      finalClips.forEach(c => maxTime = Math.max(maxTime, c.startTime + c.duration));

      return {
        ...prev,
        clips: finalClips,
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
    try {
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

        let newAssets;
        try {
           newAssets = await Promise.all(newAssetsPromises);
        } catch (err) {
           console.error("Asset import error", err);
           return;
        }
        setState(prev => ({ ...prev, assets: [...prev.assets, ...newAssets] }));
      }
    } catch (e) {
      console.error("handleAssetDrop error:", e);
    }
  };

  const handleTimelineInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    // Account for the 128px track label width + 8px padding and horizontal scrolling
    const relativeX = x - rect.left + timelineRef.current.scrollLeft - 128 - 8;
    const contentEnd = (state.clips || []).length > 0 
      ? Math.max(...(state.clips || []).map(c => c.startTime + c.duration)) 
      : state.duration;
    
    // Allow scrubbing slightly past for comfort, but bound by duration
    const newTime = Math.max(0, Math.min(contentEnd, relativeX / state.zoomLevel));
    setState(prev => ({ ...prev, currentTime: newTime }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only scrub on left click
    setState(prev => ({ ...prev, selectedClipIds: [], selectedClipId: null, selectedTransitionId: null }));
    handleTimelineInteraction(e);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Cast moveEvent as any to bypass React-specific typing and use native clientX
      const relativeX = moveEvent.clientX - timelineRef.current!.getBoundingClientRect().left + timelineRef.current!.scrollLeft - 128 - 8;
      const contentEnd = (state.clips || []).length > 0 
        ? Math.max(...(state.clips || []).map(c => c.startTime + c.duration)) 
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

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomChange = e.deltaY * -0.5;
        setState(s => {
          const newZoom = Math.max(10, Math.min(300, s.zoomLevel + zoomChange));
          const oldZoom = s.zoomLevel;
          
          if (timelineRef.current) {
            const scrollLeft = timelineRef.current.scrollLeft;
            const mouseX = e.clientX - timelineRef.current.getBoundingClientRect().left + scrollLeft - 128;
            const timeAtMouse = Math.max(0, mouseX / oldZoom);
            
            const newMouseX = timeAtMouse * newZoom;
            const newScrollLeft = newMouseX - (e.clientX - timelineRef.current.getBoundingClientRect().left - 128);

            setTimeout(() => {
              if (timelineRef.current) {
                timelineRef.current.scrollLeft = newScrollLeft;
              }
            }, 0);
          }
          return { ...s, zoomLevel: newZoom };
        });
      }
    };
    
    const node = timelineRef.current;
    if (node) {
      node.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (node) {
        node.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  return { state, setState, fileInputRef, activeTab, setActiveTab, showCropTool, setShowCropTool, isProcessing, setIsProcessing, progress, setProgress, snapEnabled, setSnapEnabled, showVideoExportModal, setShowVideoExportModal, videoExportConfig, setVideoExportConfig, exportMimeType, setExportMimeType, requestRef, lastTimeRef, sidebarTab, setSidebarTab, assetSearch, setAssetSearch, history, setHistory, pushToHistory, undo, redo, handleFocusSelected, handleSelectClip, handleSelectTransition, updateClipPosition, handleSplit, duplicateClip, moveClipTrack, removeClip, handleResetTab, handleGroupClips, handleUngroupClips, handleExportVideo, handleConvert, handleFileUpload, removeAsset, clearAssets, handleAssetDragStart, handleTimelineDrop, handleAutoSyncTransitions, handleApplyCrop, dragOver, setDragOver, contextMenu, setContextMenu, handleContextMenu, updateClipDuration, isAssetDragOver, setIsAssetDragOver, handleAssetDragOver, handleAssetDragLeave, handleAssetDrop, timelineRef, handleTimelineInteraction, handleMouseDown };
}
