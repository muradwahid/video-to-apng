const fs = require('fs');

let c = fs.readFileSync('src/App.tsx', 'utf8');

const startIndex = c.indexOf('  const [state, setState] = useState<TimelineState>({');
const endIndex = c.indexOf('  return (');

if (startIndex !== -1 && endIndex !== -1) {
  const hookBody = c.substring(startIndex, endIndex);

  // We need to form the export list
  const hookReturn = 'return { state, setState, fileInputRef, activeTab, setActiveTab, showCropTool, setShowCropTool, isProcessing, setIsProcessing, progress, setProgress, snapEnabled, setSnapEnabled, showVideoExportModal, setShowVideoExportModal, videoExportConfig, setVideoExportConfig, exportMimeType, setExportMimeType, requestRef, lastTimeRef, sidebarTab, setSidebarTab, assetSearch, setAssetSearch, history, setHistory, pushToHistory, undo, redo, handleFocusSelected, handleSelectClip, handleSelectTransition, updateClipPosition, handleSplit, duplicateClip, moveClipTrack, removeClip, handleResetTab, handleGroupClips, handleUngroupClips, handleExportVideo, handleConvert, handleFileUpload, removeAsset, clearAssets, handleAssetDragStart, handleTimelineDrop, handleAutoSyncTransitions, handleApplyCrop, dragOver, setDragOver, contextMenu, setContextMenu, handleContextMenu, updateClipDuration, isAssetDragOver, setIsAssetDragOver, handleAssetDragOver, handleAssetDragLeave, handleAssetDrop, timelineRef, handleTimelineInteraction, handleMouseDown };';

  const hookStr = `import React, { useState, useRef, useEffect, useCallback } from "react";
import { TimelineState, APNGOptions, MediaAsset, VideoClip } from "@/src/types";
import { formatTime } from "@/src/lib/utils";
import { audioEngine } from "@/src/services/audioEngine";
import { renderBackground, renderClip, renderClipWithTransition } from "@/src/lib/renderer";
import UPNG from "upng-js";
import * as WebMMuxer from 'webm-muxer';

export function useWorkspaceEditor() {
${hookBody}
  ${hookReturn}
}
`;

  fs.mkdirSync('src/hooks', { recursive: true });
  fs.writeFileSync('src/hooks/useWorkspaceEditor.ts', hookStr);
  
  // Now replace the block in App.tsx
  const appReplacement = `  const { state, setState, fileInputRef, activeTab, setActiveTab, showCropTool, setShowCropTool, isProcessing, setIsProcessing, progress, setProgress, snapEnabled, setSnapEnabled, showVideoExportModal, setShowVideoExportModal, videoExportConfig, setVideoExportConfig, exportMimeType, setExportMimeType, requestRef, lastTimeRef, sidebarTab, setSidebarTab, assetSearch, setAssetSearch, history, setHistory, pushToHistory, undo, redo, handleFocusSelected, handleSelectClip, handleSelectTransition, updateClipPosition, handleSplit, duplicateClip, moveClipTrack, removeClip, handleResetTab, handleGroupClips, handleUngroupClips, handleExportVideo, handleConvert, handleFileUpload, removeAsset, clearAssets, handleAssetDragStart, handleTimelineDrop, handleAutoSyncTransitions, handleApplyCrop, dragOver, setDragOver, contextMenu, setContextMenu, handleContextMenu, updateClipDuration, isAssetDragOver, setIsAssetDragOver, handleAssetDragOver, handleAssetDragLeave, handleAssetDrop, timelineRef, handleTimelineInteraction, handleMouseDown } = useWorkspaceEditor();\n\n`;

  // We need to add the import to App.tsx
  let newApp = c.substring(0, startIndex) + appReplacement + c.substring(endIndex);
  newApp = "import { useWorkspaceEditor } from './hooks/useWorkspaceEditor';\n" + newApp;
  
  fs.writeFileSync('src/App.tsx', newApp);
  console.log("Success Hook Extraction");
} else {
  console.log("Markers not found", startIndex, endIndex);
}
