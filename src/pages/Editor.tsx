import { useWorkspaceStore } from '../store/workspaceStore';
import { useShortcuts, ShortcutAction } from '../hooks/useShortcuts';
import { useAutoSave } from '../hooks/useAutoSave';
import { WebHIDManager } from '../components/WebHIDManager';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { SettingsModal } from '../components/SettingsModal';
import { MarkersPanel } from '../components/MarkersPanel';
import { SequenceIndexPanel } from '../components/SequenceIndexPanel';
import { useWorkspaceEditor } from '../hooks/useWorkspaceEditor';
import { TimelineSection } from '../components/TimelineSection';
import { InspectorSection } from '../components/InspectorSection';
import { PreviewSection } from '../components/PreviewSection';
import { VideoExportModal } from '../components/VideoExportModal';
import { AppHeader } from '../components/AppHeader';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { TimelineContextMenu } from '../components/TimelineContextMenu';
import { Track, ContextItem } from '../components/TimelineTrack';
import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Scissors as Scissor, Combine, 
  Crop as CropIcon, Layers, Download, Plus, Video, Music,
  Settings, History, Undo2, Redo2, Maximize2, Trash2, Sliders, Image as ImageIcon,
  Monitor, Info, Zap, RefreshCw, Volume2, Loader2, MousePointer2, MoveHorizontal, FastForward, Timer, 
  Palette, Grid, ArrowRightLeft, LayoutTemplate, Sparkles, Wand2, Search,
  Lock, Unlock, Copy, ArrowUp, ArrowDown, SplitSquareHorizontal, ListVideo, MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatTime } from "@/src/lib/utils";
import { VideoClip, TimelineState, APNGOptions, MediaAsset } from "@/src/types";
import { VideoCanvas } from "@/src/components/VideoCanvas";
import { CropTool } from "@/src/components/CropTool";
import { APNGConverter } from "@/src/components/APNGConverter";
import { PropertyInspector } from "@/src/components/PropertyInspector";
import { renderBackground, renderClip, renderClipWithTransition } from "@/src/lib/renderer";
import { TransitionPreviewIcon } from "@/src/components/TransitionPreviewIcon";
import { BackgroundPanel } from "@/src/components/BackgroundPanel";
import { TransitionPanel } from "@/src/components/TransitionPanel";
import { TemplatePanel } from "@/src/components/TemplatePanel";
import { SequencePanel } from "@/src/components/SequencePanel";
import { Filmstrip } from "@/src/components/Filmstrip";
import { AudioWaveform } from "@/src/components/AudioWaveform";
import { audioEngine } from "@/src/services/audioEngine";
import UPNG from "upng-js";
import pako from "pako";
import * as WebMMuxer from 'webm-muxer';

// @ts-ignore
window.pako = pako;

// Design constants from Bento Grid Theme
export const THEME = {
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

import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { loadProject, markProjectOpened } from '../lib/projectService';
import { supabase } from '../lib/supabase';

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, setState, fileInputRef, activeTab, setActiveTab, showCropTool, setShowCropTool, isProcessing, setIsProcessing, progress, setProgress, snapEnabled, setSnapEnabled, showVideoExportModal, setShowVideoExportModal, videoExportConfig, setVideoExportConfig, exportMimeType, setExportMimeType, requestRef, lastTimeRef, sidebarTab, setSidebarTab, assetSearch, setAssetSearch, history, setHistory, pushToHistory, undo, redo, handleFocusSelected, handleSelectClip, handleSelectTransition, updateClipPosition, handleSplit, duplicateClip, moveClipTrack, removeClip, handleResetTab, handleGroupClips, handleUngroupClips, handleExportVideo, handleConvert, handleFileUpload, removeAsset, clearAssets, handleAssetDragStart, handleTimelineDrop, handleAutoSyncTransitions, handleApplyCrop, dragOver, setDragOver, contextMenu, setContextMenu, handleContextMenu, updateClipDuration, isAssetDragOver, setIsAssetDragOver, handleAssetDragOver, handleAssetDragLeave, handleAssetDrop, timelineRef, handleTimelineInteraction, handleMouseDown } = useWorkspaceEditor();

  const { panels, theme, fontSize } = useWorkspaceStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectReady, setProjectReady] = useState(false);

  // Collaboration state
  const [collabUsers, setCollabUsers] = useState<any[]>([]);
  const wsProviderRef = useRef<any>(null);
  const docRef = useRef<any>(null);

  useEffect(() => {
    async function initProject() {
      if (!id) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
          return;
        }

        const project = await loadProject(id);
        setState((s) => ({
          ...s,
          ...project.state,
          currentProjectId: project.id,
          currentProjectName: project.name,
          saveStatus: 'idle',
          clips: project.state?.clips || [],
          assets: project.state?.assets || [],
          transitions: project.state?.transitions || [],
          duration: Math.max(30, project.duration_seconds || 30)
        }));
        await markProjectOpened(id);
        setProjectReady(true);
      } catch (e: any) {
        setProjectError(e.message || "Failed to load project");
      }
    }
    initProject();
  }, [id, navigate, setState]);

  useEffect(() => {
    if (!id || !projectReady) return;
    const doc = new Y.Doc();
    docRef.current = doc;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsProvider = new WebsocketProvider(`${protocol}//${window.location.host}/yjs`, id, doc);
    wsProviderRef.current = wsProvider;
    
    wsProvider.awareness.setLocalStateField('user', {
      name: 'Editor ' + Math.floor(Math.random() * 100),
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      playhead: 0
    });

    wsProvider.awareness.on('change', () => {
      const users = Array.from(wsProvider.awareness.getStates().values()).filter((s: any) => s.user);
      setCollabUsers(users.map((s: any) => s.user));
    });

    const stateMap = doc.getMap('projectState');
    stateMap.observe((event, transaction) => {
       if (transaction.local) return;
       const remoteState = stateMap.get('timelineState') as TimelineState;
       if (remoteState) {
          setState(remoteState);
       }
    });

    return () => {
      wsProvider.destroy();
      doc.destroy();
    };
  }, [id]);

  useEffect(() => {
    if (docRef.current) {
       const stateMap = docRef.current.getMap('projectState');
       stateMap.set('timelineState', state);
    }
  }, [state.clips, state.assets, state.markers]);

  useEffect(() => {
    if (wsProviderRef.current) {
       const curr = (wsProviderRef.current.awareness.getLocalState() as any)?.user;
       if (curr) {
          wsProviderRef.current.awareness.setLocalStateField('user', { ...curr, playhead: state.currentTime });
       }
    }
  }, [state.currentTime]);

  const handleShortcut = useCallback((action: ShortcutAction) => {
    switch (action) {
       case 'PLAY_PAUSE': setState(s => ({ ...s, isPlaying: !s.isPlaying })); break;
       case 'CUT_CLIP': handleSplit(); break;
       case 'DELETE_CLIP': removeClip(); break;
       case 'UNDO': undo(); break;
       case 'SAVE_PROJECT': /* Handled by autoSave usually, or manual save */ break;
       case 'ADD_MARKER': setState(s => ({ ...s, markers: [...(s.markers || []), { id: crypto.randomUUID(), time: Math.round(s.currentTime*100)/100, name: `Marker ${(s.markers?.length || 0)+1}`, color: '#2563EB', notes: '' }]})); break;
       case 'TOGGLE_SHORTCUTS': setShowShortcuts(s => !s); break;
    }
  }, [setState, handleSplit, removeClip, undo]);
  
  useShortcuts(handleShortcut);
  useAutoSave(state, setState);

  const handleExportProject = () => {
     const data = JSON.stringify(state);
     const blob = new Blob([data], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `project_${new Date().getTime()}.json`;
     a.click();
  };

  const handleImportProject = (file: File) => {
     const reader = new FileReader();
     reader.onload = (e) => {
        try {
           const parsed = JSON.parse(e.target?.result as string);
           if (parsed && parsed.clips) {
              setState({
                 ...parsed,
                 clips: parsed.clips || [],
                 assets: parsed.assets || [],
                 transitions: parsed.transitions || [],
                 markers: parsed.markers || [],
                 selectedClipIds: parsed.selectedClipIds || []
              });
           }
        } catch (err) {
           alert("Failed to parse project file.");
        }
     };
     reader.readAsText(file);
  };

  return (
    <div 
      className={cn("flex h-screen flex-col overflow-hidden font-sans select-none text-gray-300", 
      theme === 'light' ? 'bg-gray-100' : theme === 'high-contrast' ? 'bg-black contrast-150' : 'bg-black')}
      style={{ backgroundColor: THEME.bg, fontSize: `${fontSize * 16}px` }}
      onClick={() => setContextMenu(prev => prev ? { ...prev, show: false } : null)}
    >
      <input type="file" ref={fileInputRef} className="hidden" accept="video/*,image/*,audio/*" multiple onChange={handleFileUpload} />
      <WebHIDManager onAction={handleShortcut} />
      <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

      {/* Context Menu */}
      <TimelineContextMenu 
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        state={state}
        setState={setState}
        pushToHistory={pushToHistory}
        handleSplit={handleSplit}
        handleGroupClips={handleGroupClips}
        handleUngroupClips={handleUngroupClips}
        duplicateClip={duplicateClip}
        moveClipTrack={moveClipTrack}
        removeClip={removeClip}
        clearAssets={clearAssets}
        fileInputRef={fileInputRef}
        audioEngine={audioEngine}
      />
      {/* Header Navigation */}
      <AppHeader 
         activeTab={activeTab}
         setActiveTab={setActiveTab}
         state={state}
         setState={setState}
         setShowVideoExportModal={setShowVideoExportModal}
         theme={THEME}
         setShowShortcuts={setShowShortcuts}
         setShowSettings={setShowSettings}
         onExportProject={handleExportProject}
         onImportProject={handleImportProject}
         collabUsers={collabUsers}
      />
      {/* Main Workspace (Bento Layout) */}
      <main className="flex-1 flex overflow-hidden p-2 gap-2">
        
        {/* Left: Assets & Settings Column */}
        {panels.project.isVisible && (
          <WorkspaceSidebar 
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            isAssetDragOver={isAssetDragOver}
            handleAssetDragOver={handleAssetDragOver}
            handleAssetDragLeave={handleAssetDragLeave}
            handleAssetDrop={handleAssetDrop}
            fileInputRef={fileInputRef}
            assetSearch={assetSearch}
            setAssetSearch={setAssetSearch}
            state={state}
            handleAssetDragStart={handleAssetDragStart}
            removeAsset={removeAsset}
            pushToHistory={pushToHistory}
            setState={setState}
            handleContextMenu={handleContextMenu}
            THEME={THEME}
          />
        )}

        {/* Center: Preview Section */}
        <div className="flex-1 flex flex-col gap-2">
          {panels.program.isVisible && (
            <PreviewSection
              state={state}
              setState={setState}
              showCropTool={showCropTool}
              setShowCropTool={setShowCropTool}
              handleApplyCrop={handleApplyCrop}
              activeTab={activeTab}
              theme={THEME}
            />
          )}
          {/* Optional lower center panels */}
          <div className="flex bg-[#121212] rounded-lg border border-white/5 overflow-hidden shrink-0 max-h-64">
             {panels.sequenceIndex.isVisible && (
               <div className="flex-1 border-r border-white/5"><SequenceIndexPanel state={state} setState={setState} /></div>
             )}
             {panels.markers.isVisible && (
               <div className="flex-1"><MarkersPanel state={state} setState={setState} /></div>
             )}
          </div>
        </div>

        {/* Right: Inspector (Contextual Focus) */}
        {panels.properties.isVisible && (
          <InspectorSection
            activeTab={activeTab}
            state={state}
            setState={setState}
            handleResetTab={handleResetTab}
            showCropTool={showCropTool}
            setShowCropTool={setShowCropTool}
            handleConvert={handleConvert}
            isProcessing={isProcessing}
            progress={progress}
            theme={THEME}
          />
        )}
      </main>

      {/* Bottom: Timeline (Bento Style Footer) */}
      {panels.timeline.isVisible && (
        <TimelineSection
          state={state}
          setState={setState}
          handleSplit={handleSplit}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          undo={undo}
          redo={redo}
          history={history}
          handleFocusSelected={handleFocusSelected}
          timelineRef={timelineRef}
          handleMouseDown={handleMouseDown}
          handleContextMenu={handleContextMenu}
          dragOver={dragOver}
          setDragOver={setDragOver}
          handleTimelineDrop={handleTimelineDrop}
          handleSelectClip={handleSelectClip}
          updateClipPosition={updateClipPosition}
          updateClipDuration={updateClipDuration}
          handleSelectTransition={handleSelectTransition}
          theme={THEME}
          collabUsers={collabUsers}
        />
      )}
      
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
      <VideoExportModal 
        showVideoExportModal={showVideoExportModal}
        setShowVideoExportModal={setShowVideoExportModal}
        videoExportConfig={videoExportConfig}
        setVideoExportConfig={setVideoExportConfig}
        handleExportVideo={handleExportVideo}
        state={state}
      />

      <style dangerouslySetInnerHTML={{ __html: ".custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); } .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); }" }} />
    </div>
  );
}

