import React from "react";
import { cn, formatTime } from "@/src/lib/utils";
import { MousePointer2, FastForward, SplitSquareHorizontal, ArrowRightLeft, MoveHorizontal, Timer, Scissors as Scissor, Combine, Zap, Undo2, Redo2, Search, Video, Layers, Music } from "lucide-react";
import { Track } from "@/src/components/TimelineTrack";
import { TimelineState } from "@/src/types";

// Adding minimal interfaces to type props clearly
interface TimelineSectionProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  handleSplit: () => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  history: { undo: any[], redo: any[] };
  handleFocusSelected: () => void;
  timelineRef: React.RefObject<HTMLDivElement>;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleTimelineDrop: (e: React.DragEvent) => void;
  handleSelectClip: (id: string, toggleMulti: boolean, event?: MouseEvent) => void;
  updateClipPosition: (id: string, newStartTime: number, deltaY?: number) => void;
  updateClipDuration: (id: string, delta: number, edge: 'start' | 'end') => void;
  handleSelectTransition: (id: string) => void;
  theme: any;
  collabUsers?: any[];
}

export function TimelineSection({
  state,
  setState,
  handleSplit,
  snapEnabled,
  setSnapEnabled,
  undo,
  redo,
  history,
  handleFocusSelected,
  timelineRef,
  handleMouseDown,
  handleContextMenu,
  dragOver,
  setDragOver,
  handleTimelineDrop,
  handleSelectClip,
  updateClipPosition,
  updateClipDuration,
  handleSelectTransition,
  theme,
  collabUsers = []
}: TimelineSectionProps) {
  return (
    <footer className="h-64 border-t p-2 flex flex-col" style={{ backgroundColor: theme.timeline, borderColor: theme.borderStrong }}>
      {/* Timeline Control Bar */}
      <div className="h-10 flex items-center justify-between px-2 mb-2">
        <div className="flex gap-4 items-center">
          <div className="flex gap-1 p-1 bg-black/40 border border-white/5 rounded">
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'selection' }))}
              title="Selection Tool (V)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'selection' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'ripple' }))}
              title="Ripple Edit (B)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'ripple' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <FastForward className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'roll' }))}
              title="Roll Edit (N)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'roll' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'slip' }))}
              title="Slip Edit (Y)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'slip' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'slide' }))}
              title="Slide Edit (U)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'slide' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'rateStretch' }))}
              title="Rate Stretch (R)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'rateStretch' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <Timer className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setState(s => ({ ...s, toolMode: 'razor' }))}
              title="Razor / Cut Tool (C)"
              className={cn("w-7 h-7 rounded flex items-center justify-center transition-all", state.toolMode === 'razor' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}
            >
              <Scissor className="h-3.5 w-3.5" />
            </button>
          </div>
          
          <div className="h-4 w-px bg-white/10" />

          <div className="flex gap-1.5">
            <button 
              onClick={() => handleSplit()}
              title="Split selected track at playhead (S)"
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
            onClick={() => {
              const newTextClip: any = {
                id: Math.random().toString(36).substring(2, 11),
                name: "New Text",
                url: "",
                type: 'text',
                duration: 5,
                startTime: state.currentTime,
                sourceStart: 0,
                sourceEnd: 5,
                trackIndex: 1,
                volume: 0,
                speed: 1,
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                text: {
                  content: "Double click or edit in inspector",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 48,
                  color: "#ffffff",
                  align: "center",
                  bold: true,
                  italic: false,
                }
              };
              setState(prev => ({
                ...prev,
                clips: [...prev.clips, newTextClip],
                selectedClipId: newTextClip.id,
              }));
            }}
            title="Add text clip at playhead"
            className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-bold border border-white/5 hover:bg-gray-700 transition-all text-white active:scale-95"
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
            className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button 
            onClick={redo}
            title="Redo action"
            disabled={history.redo.length === 0}
            className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button 
            onClick={handleFocusSelected}
            title="Find Selected: Scroll timeline to the currently selected clip"
            disabled={!state.selectedClipId}
            className={cn(
              "w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm border border-white/5 hover:bg-gray-700 transition-all active:scale-95",
              !state.selectedClipId && "opacity-30 cursor-not-allowed"
            )}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-3 bg-black/40 h-8 px-3 rounded-lg border border-white/5" title="Adjust the zoom level to view tracks closer">
          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Zoom</span>
          <input 
            type="range" min="10" max="300" value={state.zoomLevel}
            onChange={(e) => {
              const newZoom = parseInt(e.target.value);
              const oldZoom = state.zoomLevel;
              const ratio = newZoom / oldZoom;
              if (timelineRef.current) {
                const scrollLeft = timelineRef.current.scrollLeft;
                const playheadX = state.currentTime * oldZoom;
                const screenX = playheadX - scrollLeft;
                const newPlayheadX = state.currentTime * newZoom;
                const newScrollLeft = newPlayheadX - screenX;
                
                setState(s => ({ ...s, zoomLevel: newZoom }));
                
                setTimeout(() => {
                  if (timelineRef.current) {
                    timelineRef.current.scrollLeft = newScrollLeft;
                  }
                }, 0);
              } else {
                setState(s => ({ ...s, zoomLevel: newZoom }));
              }
            }}
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
        <div className="space-y-1.5 min-w-max relative min-h-[300px] pb-10">
          {/* Interactive Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-4 -ml-2 z-50 transition-none cursor-ew-resize group/playhead"
            style={{ left: state.currentTime * state.zoomLevel + 128 }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleMouseDown(e);
            }}
          >
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-red-500/80 shadow-[0_0_15px_red]"></div>
            <div className="w-4 h-4 bg-red-500 absolute -top-1.5 left-1/2 -ml-2 rounded-full shadow-[0_0_15px_red] ring-4 ring-red-500/20 group-active/playhead:scale-125 transition-transform"></div>
          </div>
          
          {/* Remote Collab Playheads */}
          {collabUsers.map((user, i) => {
            if (user.playhead === undefined) return null;
            return (
              <div 
                key={i}
                className="absolute top-0 bottom-0 w-px z-40 transition-all duration-100 ease-linear pointer-events-none"
                style={{ 
                  left: user.playhead * state.zoomLevel + 128,
                  backgroundColor: user.color 
                }}
              >
                <div className="absolute -top-6 -left-3 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap opacity-70" style={{backgroundColor: user.color}}>
                  {user.name}
                </div>
                <div className="w-2 h-2 absolute -top-1 left-1/2 -ml-1 rounded-full opacity-70" style={{backgroundColor: user.color}}></div>
              </div>
            );
          })}
          
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
              {state.markers?.map(marker => (
                 <div
                   key={marker.id}
                   className="absolute top-0 w-3 h-full cursor-pointer flex justify-center group z-[51]"
                   style={{ left: marker.time * state.zoomLevel - 6, transform: 'translateX(6px)' }}
                   onClick={(e) => {
                     e.stopPropagation();
                     setState(s => ({ ...s, currentTime: marker.time }));
                   }}
                   title={`${marker.name}\n${marker.notes}`}
                 >
                   <div style={{ borderTopColor: marker.color }} className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] mt-[1px]"></div>
                 </div>
              ))}
            </div>
          </div>

          <Track 
            label="Video 1" 
            icon={<Video />} 
            clips={(state.clips || []).filter((c: any) => c.trackIndex === 0)} 
            transitions={state.transitions}
            zoom={state.zoomLevel} 
            currentTime={state.currentTime}
            onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
            onSelect={handleSelectClip}
            onMove={updateClipPosition}
            onTrim={updateClipDuration}
            selectedIds={state.selectedClipIds}
            onContextMenu={handleContextMenu}
            onSelectTransition={handleSelectTransition}
            selectedTransitionId={state.selectedTransitionId}
          />
          <Track 
            label="Overlay" 
            icon={<Layers />} 
            clips={(state.clips || []).filter((c: any) => c.trackIndex === 1)} 
            transitions={state.transitions}
            zoom={state.zoomLevel} 
            currentTime={state.currentTime}
            onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
            onSelect={handleSelectClip}
            onMove={updateClipPosition}
            onTrim={updateClipDuration}
            selectedIds={state.selectedClipIds}
            onContextMenu={handleContextMenu}
            onSelectTransition={handleSelectTransition}
            selectedTransitionId={state.selectedTransitionId}
          />
          <Track 
            label="Music" 
            icon={<Music />} 
            clips={(state.clips || []).filter((c: any) => c.trackIndex === 2)} 
            transitions={state.transitions}
            zoom={state.zoomLevel} 
            currentTime={state.currentTime}
            onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
            onSelect={handleSelectClip}
            onMove={updateClipPosition}
            onTrim={updateClipDuration}
            selectedIds={state.selectedClipIds}
            onContextMenu={handleContextMenu}
            onSelectTransition={handleSelectTransition}
            selectedTransitionId={state.selectedTransitionId}
          />
          <Track 
            label="Voice" 
            icon={<Zap />} 
            clips={(state.clips || []).filter((c: any) => c.trackIndex === 3)} 
            transitions={state.transitions}
            zoom={state.zoomLevel} 
            currentTime={state.currentTime}
            onSeek={(t: number) => setState(s => ({...s, currentTime: t}))} 
            onSelect={handleSelectClip}
            onMove={updateClipPosition}
            onTrim={updateClipDuration}
            selectedIds={state.selectedClipIds}
            onContextMenu={handleContextMenu}
            onSelectTransition={handleSelectTransition}
            selectedTransitionId={state.selectedTransitionId}
          />
        </div>
      </div>
    </footer>
  );
}
