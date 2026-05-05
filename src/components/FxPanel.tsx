import React, { useState } from 'react';
import { TimelineState } from '../types';
import { EFFECT_DEFS, TRANSITION_DEFS, MOTION_PRESETS } from '../lib/effectsDefs';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Star, Zap, Activity, FastForward } from 'lucide-react';

interface FxPanelProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  pushToHistory: (s: TimelineState) => void;
}

export function FxPanel({ state, setState, pushToHistory }: FxPanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'transitions'|'effects'|'motion'>('all');

  const filteredEffects = EFFECT_DEFS.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const filteredTransitions = TRANSITION_DEFS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleDragStart = (e: React.DragEvent, type: string, id: string) => {
    if (type === 'transition') {
      e.dataTransfer.setData("application/transition-type", id);
    } else if (type === 'motion') {
      e.dataTransfer.setData("application/motion-type", id);
    } else {
      e.dataTransfer.setData("application/effect-type", id);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Search */}
      <div className="relative group">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
          <Search size={12} />
        </div>
        <input 
          type="text"
          placeholder="Search effects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-md py-2 pl-8 pr-2 text-xs focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 p-1 bg-black/40 border border-white/5 rounded-lg shrink-0">
         <button onClick={() => setFilter('all')} className={`flex-1 text-[9px] uppercase tracking-widest font-bold py-1.5 rounded ${filter === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>All</button>
         <button onClick={() => setFilter('transitions')} className={`flex-1 text-[9px] uppercase tracking-widest font-bold py-1.5 rounded ${filter === 'transitions' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Transitions</button>
         <button onClick={() => setFilter('effects')} className={`flex-1 text-[9px] uppercase tracking-widest font-bold py-1.5 rounded ${filter === 'effects' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Effects</button>
         <button onClick={() => setFilter('motion')} className={`flex-1 text-[9px] uppercase tracking-widest font-bold py-1.5 rounded ${filter === 'motion' ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Motion</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-4 custom-scrollbar">
         {(filter === 'all' || filter === 'effects') && (
           <div className="space-y-2">
             <div className="flex items-center gap-2 mb-3">
                <Zap size={10} className="text-blue-500" />
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Video Effects</h4>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {filteredEffects.map(ef => (
                 <div
                   key={ef.id}
                   draggable
                   onDragStart={(e) => handleDragStart(e, 'effect', ef.id)}
                   className="bg-black/40 border border-white/5 hover:border-blue-500/50 rounded p-2 cursor-grab active:cursor-grabbing group transition-colors relative"
                 >
                   <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Star size={10} className="text-gray-500 hover:text-yellow-500" />
                   </div>
                   <div className="w-6 h-6 mb-2 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                     <Activity size={12} className="text-blue-400" />
                   </div>
                   <div className="text-[10px] font-bold text-gray-300">{ef.name}</div>
                   <div className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">{ef.category}</div>
                 </div>
               ))}
               {filteredEffects.length === 0 && <div className="col-span-2 text-center text-[10px] text-gray-600 py-4">No effects found</div>}
             </div>
           </div>
         )}

         {(filter === 'all' || filter === 'transitions') && (
           <div className="space-y-2">
             <div className="flex items-center gap-2 mb-3">
                <Activity size={10} className="text-emerald-500" />
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Transitions</h4>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {filteredTransitions.map(t => (
                 <div
                   key={t.id}
                   draggable
                   onDragStart={(e) => handleDragStart(e, 'transition', t.id)}
                   className="bg-black/40 border border-white/5 hover:border-emerald-500/50 rounded p-2 cursor-grab active:cursor-grabbing group transition-colors relative"
                 >
                   <div className="w-6 h-6 mb-2 rounded bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                     <Zap size={12} className="text-emerald-400" />
                   </div>
                   <div className="text-[10px] font-bold text-gray-300">{t.name}</div>
                   <div className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">{t.category}</div>
                 </div>
               ))}
               {filteredTransitions.length === 0 && <div className="col-span-2 text-center text-[10px] text-gray-600 py-4">No transitions found</div>}
             </div>
           </div>
         )}
         
         {(filter === 'all' || filter === 'motion') && (
           <div className="space-y-2">
             <div className="flex items-center gap-2 mb-3">
                <FastForward size={10} className="text-pink-500" />
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Motion Presets</h4>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {MOTION_PRESETS.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map(m => (
                 <div
                   key={m.id}
                   draggable
                   onDragStart={(e) => handleDragStart(e, 'motion', m.id)}
                   className="bg-black/40 border border-white/5 hover:border-pink-500/50 rounded p-2 cursor-grab active:cursor-grabbing group transition-colors relative"
                 >
                   <div className="w-6 h-6 mb-2 rounded bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                     <FastForward size={12} className="text-pink-400" />
                   </div>
                   <div className="text-[10px] font-bold text-gray-300">{m.name}</div>
                   <div className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">{m.category}</div>
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
