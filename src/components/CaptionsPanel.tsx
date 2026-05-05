import React, { useRef } from 'react';
import { TimelineState, VideoClip } from '../types';
import { parseSRT, parseVTT, formatSRT, formatVTT } from '../lib/captionParser';
import { FileText, Download, Upload, Type, Clock } from 'lucide-react';

export function CaptionsPanel({ state, setState }: { state: TimelineState, setState: React.Dispatch<React.SetStateAction<TimelineState>> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const isVTT = file.name.toLowerCase().endsWith('.vtt');
      
      let nodes = [];
      if (isVTT) {
        nodes = parseVTT(content);
      } else {
        nodes = parseSRT(content);
      }
      
      const captionGroupTrackId = crypto.randomUUID();
      
      const newClips: VideoClip[] = nodes.map(node => ({
        id: crypto.randomUUID(),
        name: `Caption: ${node.text.slice(0, 20)}`,
        url: '',
        type: 'caption',
        duration: node.end - node.start,
        startTime: node.start,
        sourceStart: 0,
        sourceEnd: node.end - node.start,
        volume: 1,
        speed: 1,
        trackIndex: 3, // Put on top track
        locked: false,
        transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
        text: {
           content: node.text,
           fontFamily: 'Inter',
           fontSize: 32,
           color: '#ffffff',
           align: 'center',
           bold: false,
           italic: false,
           backgroundColor: 'rgba(0,0,0,0.5)',
           captionTrackId: captionGroupTrackId
        }
      }));
      
      setState(prev => ({
        ...prev,
        clips: [...prev.clips, ...newClips]
      }));
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleExport = (format: 'srt' | 'vtt') => {
    const captionClips = (state.clips || []).filter(c => c.type === 'caption').sort((a,b) => a.startTime - b.startTime);
    const nodes = captionClips.map((c, i) => ({
       id: (i+1).toString(),
       start: c.startTime,
       end: c.startTime + c.duration,
       text: c.text?.content || ''
    }));
    
    const data = format === 'srt' ? formatSRT(nodes) : formatVTT(nodes);
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const captionClips = (state.clips || []).filter(c => c.type === 'caption').sort((a,b) => a.startTime - b.startTime);

  return (
    <div className="space-y-4 px-2">
      <div className="flex gap-2">
         <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold uppercase tracking-widest text-white flex items-center justify-center gap-1">
           <Upload size={12} /> Import
         </button>
         <button onClick={() => handleExport('srt')} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded text-[10px] font-bold uppercase tracking-widest text-white flex items-center justify-center gap-1" disabled={captionClips.length===0}>
           <Download size={12} /> SRT
         </button>
         <button onClick={() => handleExport('vtt')} className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded text-[10px] font-bold uppercase tracking-widest text-white flex items-center justify-center gap-1" disabled={captionClips.length===0}>
           <Download size={12} /> VTT
         </button>
      </div>
      <input type="file" accept=".srt,.vtt,.txt" ref={fileInputRef} className="hidden" onChange={handleImport} />
      
      {captionClips.length > 0 ? (
        <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
           {captionClips.map((clip, i) => (
             <div key={clip.id} 
               onClick={() => setState(prev => ({...prev, selectedClipId: clip.id, selectedClipIds: [clip.id]}))}
               className={`p-2 rounded border transition-colors cursor-pointer ${state.selectedClipId === clip.id ? 'bg-blue-600/20 border-blue-500' : 'bg-black/40 border-white/10 hover:border-white/30'}`}
             >
                <div className="flex justify-between items-center mb-1">
                   <div className="text-[10px] font-mono text-gray-400 font-bold">{i+1}</div>
                   <div className="flex items-center gap-1 text-[9px] font-mono text-gray-500">
                     <Clock size={10} />
                     <span>{clip.startTime.toFixed(2)} - {(clip.startTime + clip.duration).toFixed(2)}</span>
                   </div>
                </div>
                {state.selectedClipId === clip.id ? (
                   <textarea 
                     value={clip.text?.content || ''}
                     onChange={(e) => {
                       const val = e.target.value;
                       setState(prev => ({
                         ...prev,
                         clips: prev.clips.map(c => c.id === clip.id ? {...c, text: {...(c.text as any), content: val}} : c)
                       }))
                     }}
                     className="w-full text-xs bg-black p-1.5 rounded border border-white/20 outline-none text-white h-16"
                   />
                ) : (
                   <p className="text-xs text-gray-300 line-clamp-2">{clip.text?.content}</p>
                )}
             </div>
           ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-gray-500 text-center border border-dashed border-white/10 rounded">
          <FileText size={24} className="mb-2 opacity-50" />
          <p className="text-[10px] uppercase font-bold tracking-widest">No Captions</p>
          <p className="text-[9px] mt-1">Import a file or create text clips</p>
        </div>
      )}
    </div>
  );
}
