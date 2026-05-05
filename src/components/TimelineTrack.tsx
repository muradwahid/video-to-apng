import React from "react";
import { cn, formatTime } from "@/src/lib/utils";
import { motion } from "motion/react";
import { Filmstrip } from "@/src/components/Filmstrip";
import { AudioWaveform } from "@/src/components/AudioWaveform";
import { Lock, Scissors, Grid } from "lucide-react";
import { TransitionPreviewIcon } from "@/src/components/TransitionPreviewIcon";

export function Track({ label, icon, clips, zoom, currentTime, transitions = [], onSeek, onSelect, onMove, onTrim, selectedIds, onContextMenu, onSelectTransition, selectedTransitionId }: any) {
  return (
    <div className="relative h-14 flex bg-white/[0.02] border-b border-white/[0.05] min-w-max group">
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
        {/* Playhead Line for this track */}
        {currentTime !== undefined && (
          <div 
            className="absolute top-0 bottom-0 w-px bg-red-500/80 z-40 pointer-events-none"
            style={{ left: currentTime * zoom }}
          />
        )}
        
        {/* Clips Rendering */}
        {clips?.map((c: any) => (
          <motion.div 
            key={`${c.id}-${c.startTime}`}
            drag={c.locked ? false : (selectedIds?.includes(c.id) ? true : false)}
            dragMomentum={false}
            dragConstraints={{ left: -c.startTime * zoom }}
            dragElastic={0}
            onMouseDown={(e) => e.stopPropagation()}
            onDragEnd={(e, info) => {
              const deltaX = info.offset.x;
              const deltaY = info.offset.y;
              onMove(c.id, c.startTime + deltaX / zoom, deltaY);
            }}
            onContextMenu={(e) => onContextMenu(e, c.id)}
            className={cn(
              "absolute h-10 top-2 rounded-md border flex items-start pt-1 px-1 cursor-grab overflow-hidden active:cursor-grabbing shadow-lg group/clip text-white",
              selectedIds?.includes(c.id) ? "ring-2 ring-white/50 z-20 shadow-2xl" : "z-10",
              c.type === "video" ? (selectedIds?.includes(c.id) ? "bg-blue-500/40 border-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20") :
              c.type === "audio" ? (selectedIds?.includes(c.id) ? "bg-emerald-500/40 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-emerald-600/10 border-emerald-500/30 hover:bg-emerald-600/20") :
              c.type === "caption" ? (selectedIds?.includes(c.id) ? "bg-yellow-500/40 border-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.3)]" : "bg-yellow-600/10 border-yellow-500/30 hover:bg-yellow-600/20") :
              (selectedIds?.includes(c.id) ? "bg-purple-500/40 border-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]" : "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20")
            )}
            style={{ left: c.startTime * zoom, width: (c.duration) * zoom }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.id, e.shiftKey || e.ctrlKey || e.metaKey || false, e.nativeEvent);
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
               {c.locked && <Lock size={10} className="text-white opacity-80 shrink-0" />}
               {c.groupId && <Grid size={10} className="text-white opacity-80 shrink-0" title="Grouped Clip" />}
               <span className="text-[8px] font-bold opacity-70 uppercase tracking-tighter truncate">{c.name}</span>
            </div>
            
            {/* Trim Handles */}
            {selectedIds?.includes(c.id) && !c.locked && (
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
          const fromClip = (clips || []).find((c: any) => c.id === t.fromClipId);
          const toClip = (clips || []).find((c: any) => c.id === t.toClipId);
          if (!fromClip || !toClip) return null;
          
          const junction = fromClip.startTime + fromClip.duration;
          const start = junction - t.duration / 2;
          
          return (
            <div 
              key={t.id}
              className={cn(
                "absolute h-full top-0 border-x group/transition cursor-pointer transition-all z-[25] flex items-center justify-center backdrop-blur-[2px]",
                selectedTransitionId === t.id ? "bg-orange-500/50 border-orange-400 ring-2 ring-orange-500" : "bg-blue-500/30 border-blue-400 hover:bg-blue-500/50"
              )}
              style={{ left: start * zoom, width: t.duration * zoom }}
              title={`Transition: ${t.type}\nDouble click to remove`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTransition) onSelectTransition(t.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onContextMenu(e, t.id, 'transition');
              }}
            >
               <div className="absolute opacity-0 group-hover/transition:opacity-100 flex pointer-events-none -top-20 z-50 transition-opacity translate-y-2 group-hover/transition:translate-y-0 duration-200">
                 <TransitionPreviewIcon type={t.type} />
               </div>
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

export function ContextItem({ label, tooltip, icon, onClick, danger, disabled }: any) {
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

