import React, { useState } from 'react';
import { TimelineState, VideoClip } from '../types';
import { formatTime, cn } from '../lib/utils';
import { Search, List, ArrowRight } from 'lucide-react';

interface SequencePanelProps {
  state: TimelineState;
  onSelectClip: (id: string) => void;
}

export function SequencePanel({ state, onSelectClip }: SequencePanelProps) {
  const [search, setSearch] = useState('');

  const filteredClips = (state.clips || [])
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-2 rounded">
        <Search size={14} className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Search sequence index..." 
          className="bg-transparent border-none text-xs text-white outline-none w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-2 opacity-50">
            <List size={32} />
            <span className="text-xs">No clips found in sequence</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-gray-400 border-separate border-spacing-y-1">
            <thead>
              <tr className="uppercase text-[8px] tracking-wider font-bold text-gray-500 border-b border-white/10">
                <th className="pb-2 font-normal">Name</th>
                <th className="pb-2 font-normal">Track</th>
                <th className="pb-2 font-normal text-right">In</th>
                <th className="pb-2 font-normal text-right">Out</th>
              </tr>
            </thead>
            <tbody>
              {filteredClips.map((clip) => (
                <tr 
                  key={clip.id}
                  onClick={() => onSelectClip(clip.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-white/10 group",
                    state.selectedClipId === clip.id ? "bg-blue-600/20 text-white" : "bg-white/5"
                  )}
                >
                  <td className="p-2 rounded-l w-1/2 align-middle">
                     <span className="truncate block w-24 group-hover:text-blue-400 transition-colors">{clip.name}</span>
                  </td>
                  <td className="p-2 align-middle">T{clip.trackIndex + 1}</td>
                  <td className="p-2 text-right font-mono align-middle">{formatTime(clip.startTime)}</td>
                  <td className="p-2 text-right rounded-r font-mono align-middle">{formatTime(clip.startTime + clip.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
