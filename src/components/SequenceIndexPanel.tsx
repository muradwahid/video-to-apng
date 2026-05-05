import React, { useState } from 'react';
import { TimelineState } from '../types';
import { formatTime, cn } from '../lib/utils';
import { Search, Video, Music, Layers, Type, Trash2, ArrowUpDown } from 'lucide-react';

interface SequencePanelProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
}

type SortField = 'name' | 'track' | 'startTime' | 'duration';

export function SequenceIndexPanel({ state, setState }: SequencePanelProps) {
   const [search, setSearch] = useState('');
   const [sortField, setSortField] = useState<SortField>('startTime');
   const [sortAsc, setSortAsc] = useState(true);

   const handleSort = (field: SortField) => {
      if (sortField === field) setSortAsc(!sortAsc);
      else { setSortField(field); setSortAsc(true); }
   };

   const filtered = (state.clips || []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
   
   const sorted = [...filtered].sort((a,b) => {
      let result = 0;
      if (sortField === 'name') result = a.name.localeCompare(b.name);
      else if (sortField === 'track') result = (a.trackIndex || 0) - (b.trackIndex || 0);
      else if (sortField === 'startTime') result = a.startTime - b.startTime;
      else if (sortField === 'duration') result = a.duration - b.duration;
      return sortAsc ? result : -result;
   });

   const getTypeIcon = (type: string) => {
      switch(type) {
         case 'video': return <Video size={12} className="text-blue-400" />;
         case 'audio': return <Music size={12} className="text-green-400" />;
         case 'text': return <Type size={12} className="text-yellow-400" />;
         default: return <Layers size={12} className="text-purple-400" />;
      }
   };

   return (
      <div className="flex flex-col h-full bg-[#121212] overflow-hidden">
        <div className="p-2 border-b border-white/5">
           <div className="relative">
             <Search size={12} className="absolute left-2 top-1.5 text-gray-500" />
             <input 
                type="text" placeholder="Search sequence..." 
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#1A1A1A] border-white/10 rounded pl-7 pr-2 py-1 text-xs text-white"
             />
           </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
           <table className="w-full text-left text-xs">
              <thead className="bg-[#161616] sticky top-0 text-gray-400 font-bold uppercase tracking-widest text-[9px]">
                 <tr>
                    <th className="p-2 cursor-pointer hover:bg-white/5" onClick={() => handleSort('name')}>Clip Name {sortField === 'name' && <ArrowUpDown size={8} className="inline ml-1"/>}</th>
                    <th className="p-2 cursor-pointer hover:bg-white/5" onClick={() => handleSort('track')}>Track {sortField === 'track' && <ArrowUpDown size={8} className="inline ml-1"/>}</th>
                    <th className="p-2 cursor-pointer hover:bg-white/5" onClick={() => handleSort('startTime')}>In {sortField === 'startTime' && <ArrowUpDown size={8} className="inline ml-1"/>}</th>
                    <th className="p-2 cursor-pointer hover:bg-white/5" onClick={() => handleSort('duration')}>Duration {sortField === 'duration' && <ArrowUpDown size={8} className="inline ml-1"/>}</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                 {sorted.map(c => (
                    <tr 
                       key={c.id} 
                       className={cn("hover:bg-[#1A1A1A] cursor-pointer transition-colors", state.selectedClipId === c.id && "bg-blue-600/10")}
                       onClick={() => setState(s => ({ ...s, selectedClipId: c.id, currentTime: c.startTime }))}
                    >
                       <td className="p-2 text-gray-300 flex items-center gap-2">
                          {getTypeIcon(c.type)}
                          <span className="truncate max-w-[120px]">{c.name}</span>
                       </td>
                       <td className="p-2 text-gray-400">Track {c.trackIndex + 1}</td>
                       <td className="p-2 text-gray-400 font-mono">{formatTime(c.startTime)}</td>
                       <td className="p-2 text-gray-400 font-mono">{formatTime(c.duration)}</td>
                    </tr>
                 ))}
                 {sorted.length === 0 && (
                    <tr>
                       <td colSpan={4} className="p-8 text-center text-gray-500 uppercase font-bold text-[10px] tracking-widest">
                          No clips match query
                       </td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>
   );
}
