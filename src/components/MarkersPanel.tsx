import React, { useState } from 'react';
import { Marker, TimelineState } from '../types';
import { formatTime, cn } from '../lib/utils';
import { Download, Plus, Trash2, MapPin } from 'lucide-react';
import { InspectorSection } from './InspectorSection';

interface MarkersPanelProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
}

export function MarkersPanel({ state, setState }: MarkersPanelProps) {
  const [search, setSearch] = useState('');
  
  const markers = state.markers || [];
  const filtered = markers.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.notes.toLowerCase().includes(search.toLowerCase()));

  const handleUpdate = (id: string, updates: Partial<Marker>) => {
     setState(s => ({
        ...s,
        markers: s.markers?.map(m => m.id === id ? { ...m, ...updates } : m)
     }));
  };

  const handleRemove = (id: string) => {
     setState(s => ({
        ...s,
        markers: s.markers?.filter(m => m.id !== id)
     }));
  };

  const handleJump = (time: number) => {
     setState(s => ({ ...s, currentTime: Math.max(0, Math.min(s.duration, time)) }));
  };

  const handleExportCSV = () => {
     let csvContent = "data:text/csv;charset=utf-8,ID,Time,Name,Color,Notes\n";
     markers.forEach(row => {
        csvContent += `${row.id},${formatTime(row.time)},"${row.name.replace(/"/g, '""')}","${row.color}","${row.notes.replace(/"/g, '""')}"\n`;
     });
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", "markers.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  return (
     <div className="flex flex-col h-full bg-[#121212] overflow-hidden">
        <div className="p-3 border-b border-white/5 flex gap-2">
           <input 
              type="text" 
              placeholder="Search markers..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-[#1A1A1A] border-white/10 rounded px-2 py-1 text-xs text-white"
           />
           <button onClick={handleExportCSV} className="px-2 bg-white/10 hover:bg-white/20 rounded text-gray-300 transition-colors" title="Export CSV">
              <Download size={14} />
           </button>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-2">
           {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                 <MapPin className="w-8 h-8 opacity-20 mb-2" />
                 <p className="text-[10px] uppercase font-bold tracking-widest">No Markers (Press M)</p>
              </div>
           )}
           {filtered.sort((a,b) => a.time - b.time).map(m => (
              <div key={m.id} className="bg-[#1A1A1A] border border-white/5 p-2 rounded-lg group">
                 <div className="flex items-center gap-2 mb-2">
                    <input type="color" value={m.color} onChange={e => handleUpdate(m.id, { color: e.target.value })} className="w-5 h-5 rounded cursor-pointer border-none p-0 outline-none" />
                    <input 
                       type="text" 
                       value={m.name} 
                       onChange={e => handleUpdate(m.id, { name: e.target.value })} 
                       className="flex-1 bg-transparent border-none text-xs font-bold text-white focus:outline-none"
                    />
                    <button onClick={() => handleJump(m.time)} className="text-[10px] font-mono text-blue-400 hover:text-blue-300">{formatTime(m.time)}</button>
                    <button onClick={() => handleRemove(m.id)} className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                 </div>
                 <textarea 
                    value={m.notes} 
                    onChange={e => handleUpdate(m.id, { notes: e.target.value })} 
                    placeholder="Notes..."
                    className="w-full bg-[#0A0A0A] border border-white/5 rounded p-1.5 text-xs text-gray-400 resize-none h-12 focus:outline-none focus:border-white/20"
                 />
              </div>
           ))}
        </div>
     </div>
  );
}
