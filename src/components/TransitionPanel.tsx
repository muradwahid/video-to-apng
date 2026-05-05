import React from 'react';
import { Ghost, MoveHorizontal, MoveVertical, ZoomIn, ZoomOut, Loader2, Sparkles, Wand2, ArrowRightLeft, Sun, Maximize, Circle, RotateCw, Wind, Search } from 'lucide-react';
import { cn } from '../lib/utils';

const TRANSITION_PRESETS = [
  { id: 'fade', label: 'Black Fade', icon: <Ghost size={16} /> },
  { id: 'cross-dissolve', label: 'Dissolve', icon: <Sparkles size={16} /> },
  { id: 'slide-left', label: 'Swipe Left', icon: <MoveHorizontal size={16} /> },
  { id: 'slide-right', label: 'Swipe Right', icon: <MoveHorizontal className="rotate-180" size={16} /> },
  { id: 'slide-up', label: 'Swipe Up', icon: <MoveVertical size={16} /> },
  { id: 'zoom-in', label: 'Camera Jump', icon: <ZoomIn size={16} /> },
  { id: 'blur', label: 'Dream Blur', icon: <Loader2 size={16} /> },
  { id: 'glitch', label: 'Glitch FX', icon: <Wand2 size={16} /> },
  { id: 'pulse', label: 'White Pulse', icon: <Sun size={16} /> },
  { id: 'wipe', label: 'Linear Wipe', icon: <Maximize size={16} /> },
  { id: 'iris', label: 'Iris Out', icon: <Circle size={16} /> },
  { id: 'rotate', label: 'Spin Switch', icon: <RotateCw size={16} /> },
  { id: 'spiral', label: 'Spiral Zoom', icon: <Wind size={16} /> },
];

interface TransitionPanelProps {
  onAutoSync?: () => void;
}

export const TransitionPanel: React.FC<TransitionPanelProps> = ({ onAutoSync }) => {
  const [search, setSearch] = React.useState('');

  const filteredTransitions = TRANSITION_PRESETS.filter(t => 
    !search || t.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="relative group mb-1">
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500">
           <Search size={10} />
        </div>
        <input 
          type="text"
          placeholder="FIND Transitions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-[8px] font-bold uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Library</h4>
        <div className="flex gap-1">
           <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
           <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {filteredTransitions.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/transition-type', t.id);
            }}
            className="group flex flex-col items-center gap-2 p-3 bg-white/5 border border-white/5 rounded-lg hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-grab active:cursor-grabbing"
          >
            <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-gray-400 group-hover:text-blue-400 group-hover:scale-110 transition-all">
              {t.icon}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-tighter text-gray-400 group-hover:text-white">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded-lg space-y-2">
         <div className="flex items-center gap-2 text-blue-400">
            <Sparkles size={12} />
            <span className="text-[9px] font-bold uppercase tracking-widest">AI Cut Assistant</span>
         </div>
         <p className="text-[8px] text-blue-300 opacity-70 leading-relaxed">Automatically detect scene changes and apply cinematic transitions based on audio beats.</p>
         <button 
           onClick={onAutoSync}
           className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-bold uppercase tracking-widest rounded transition-all active:scale-95 shadow-lg shadow-blue-500/20"
         >
           Auto-Sync Transitions
         </button>
      </div>

      <div className="mt-auto space-y-2">
         <div className="text-[8px] text-gray-600 italic px-1">Drag and drop transitions between clips on the timeline</div>
      </div>
    </div>
  );
};
