import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Scissors as Scissor, Combine, Grid, Lock, Unlock, Volume2, Copy, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { ContextItem } from "@/src/components/TimelineTrack";

export function TimelineContextMenu({
  contextMenu,
  setContextMenu,
  state,
  setState,
  pushToHistory,
  handleSplit,
  handleGroupClips,
  handleUngroupClips,
  duplicateClip,
  moveClipTrack,
  removeClip,
  clearAssets,
  fileInputRef,
  audioEngine
}: any) {
  return (
    <AnimatePresence>
      {contextMenu?.show && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-50 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-2xl p-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'transition' ? (
             <ContextItem 
               label="Remove Transition" 
               tooltip="Delete this transition effect" 
               icon={<Trash2 size={12}/>} 
               onClick={() => {
                 pushToHistory(state);
                 setState((prev: any) => ({
                   ...prev,
                   transitions: (prev.transitions || []).filter((t: any) => t.id !== contextMenu.targetId)
                 }));
                 setContextMenu((prev: any) => prev ? { ...prev, show: false } : null);
               }} 
               danger 
             />
          ) : contextMenu.targetId ? (
              <>
               <ContextItem label="Split at playhead" tooltip="Split this clip precisely at the current playhead position" icon={<Scissor size={12}/>} onClick={() => { handleSplit(contextMenu.targetId); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} disabled={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked} />
               {state.selectedClipIds.length > 1 && (
                  <ContextItem label="Group Clips" tooltip="Group selected clips together" icon={<Combine size={12}/>} onClick={() => { handleGroupClips(); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               )}
               {(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.groupId && (
                  <ContextItem label="Ungroup Clips" tooltip="Remove grouping from this clip's group" icon={<Grid size={12}/>} onClick={() => { handleUngroupClips(); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               )}
               <ContextItem 
                 label={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked ? "Unlock Clip" : "Lock Clip"} 
                 tooltip={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked ? "Allow editing this clip" : "Prevent editing this clip"} 
                 icon={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked ? <Unlock size={12}/> : <Lock size={12}/>} 
                 onClick={() => {
                   const targetId = contextMenu.targetId;
                   setState((prev: any) => {
                     const newClips = prev.clips.map((c: any) => {
                       if (c.id !== targetId) return c;
                       return { ...c, locked: !c.locked };
                     });
                     return { ...prev, clips: newClips };
                   });
                   setContextMenu((prev: any) => prev ? { ...prev, show: false } : null);
                 }} 
               />
               <ContextItem 
                 label={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.audio?.muted ? "Unmute Clip" : "Mute Clip"} 
                 tooltip="Toggle audio for this clip" 
                 icon={<Volume2 size={12}/>} 
                 onClick={() => {
                   const targetId = contextMenu.targetId;
                   setState((prev: any) => {
                     const newClips = prev.clips.map((c: any) => {
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
                   setContextMenu((prev: any) => prev ? { ...prev, show: false } : null);
                 }} 
               />
               <ContextItem label="Duplicate Clip" tooltip="Create a copy of this clip" icon={<Copy size={12}/>} onClick={() => { duplicateClip(contextMenu.targetId); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               <ContextItem label="Move Up Track" tooltip="Move the clip to an outer track layer" icon={<ArrowUp size={12}/>} disabled={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.trackIndex === 0 || (state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked} onClick={() => { if(contextMenu.targetId) moveClipTrack(contextMenu.targetId, -1); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               <ContextItem label="Move Down Track" tooltip="Move the clip to an inner track layer" icon={<ArrowDown size={12}/>} disabled={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.trackIndex === 3 || (state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked} onClick={() => { if(contextMenu.targetId) moveClipTrack(contextMenu.targetId, 1); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               <ContextItem label="Export for After Effects" tooltip="Download JSON for AE Dynamic Link roundtrip" icon={<ArrowUp size={12}/>} onClick={() => {
                   const clip = (state.clips || []).find((c: any) => c.id === contextMenu.targetId);
                   if (clip) {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clip, null, 2));
                      const a = document.createElement('a');
                      a.href = dataStr;
                      a.download = `clip_${clip.id}_ae.json`;
                      a.click();
                   }
                   setContextMenu((prev: any) => prev ? { ...prev, show: false } : null);
               }} />
               <ContextItem label="Delete Clip" tooltip="Remove this clip from the timeline" icon={<Trash2 size={12}/>} onClick={() => { removeClip(contextMenu.targetId); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} disabled={(state.clips || []).find((c: any) => c.id === contextMenu.targetId)?.locked} danger />
              </>
           ) : (
             <>
               <ContextItem label="Add Media" tooltip="Import new media to project" icon={<Plus size={12}/>} onClick={() => { fileInputRef.current?.click(); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} />
               <ContextItem label="Split Selected" tooltip="Split the currently selected clip at the playhead" icon={<Scissor size={12}/>} onClick={() => { handleSplit(); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} disabled={!state.selectedClipId || (state.clips || []).find((c: any) => c.id === state.selectedClipId)?.locked} />
               <ContextItem label="Clear Project" tooltip="Remove all assets and reset the project" icon={<Trash2 size={12}/>} onClick={() => { clearAssets(); setContextMenu((prev: any) => prev ? { ...prev, show: false } : null); }} danger />
             </>
           )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
