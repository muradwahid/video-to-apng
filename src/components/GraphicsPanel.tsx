import React, { useState } from 'react';
import { TimelineState, VideoClip } from '../types';
import { Layers, Search, AlignLeft, Square, Circle } from 'lucide-react';

const TEMPLATES = [
  { id: '1', name: 'Lower Third Pro', icon: <AlignLeft size={16}/>, layers: [
    { type: 'shape', fill: 'rgba(0,0,0,0.8)', stroke: 'transparent', w: 400, h: 80, x: -300, y: 300 },
    { type: 'text', content: 'FirstName LastName', fontSize: 48, color: '#ffffff', bold: true, x: -480, y: 280, align: 'left' },
    { type: 'text', content: 'Chief Executive Officer', fontSize: 24, color: '#3b82f6', x: -480, y: 320, align: 'left' }
  ]},
  { id: '2', name: 'Minimal Title', icon: <Square size={16}/>, layers: [
    { type: 'text', content: 'A CINEMATIC JOURNEY', fontSize: 64, color: '#ffffff', bold: true, letterSpacing: 10, align: 'center', x: 0, y: 0 }
  ]},
  { id: '3', name: 'News Ticker', icon: <Layers size={16}/>, layers: [
    { type: 'shape', fill: '#dc2626', stroke: 'transparent', w: 1920, h: 60, x: 0, y: 450 },
    { type: 'text', content: 'BREAKING: MAJOR UPDATE RECEIVED \u2022 MORE DETAILS COMING SOON', fontSize: 32, bold: true, color: '#ffffff', align: 'left', x: -800, y: 450 }
  ]}
];

export function GraphicsPanel({ state, setState }: { state: TimelineState, setState: React.Dispatch<React.SetStateAction<TimelineState>> }) {
  const [search, setSearch] = useState('');

  const handleApply = (template: any) => {
    // Generate Graphic Layer structures
    const graphicLayers = template.layers.map((l: any, i: number) => {
       const gl: any = {
         id: crypto.randomUUID(),
         name: `Layer ${i+1}`,
         type: l.type,
         isVisible: true,
         isLocked: false,
         transform: { x: l.x || 0, y: l.y || 0, scaleX: 1, scaleY: 1, rotation: 0 }
       };
       if (l.type === 'text') {
         gl.text = {
           content: l.content,
           fontFamily: 'Inter',
           fontSize: l.fontSize,
           color: l.color,
           textAlign: l.align || 'center',
           bold: l.bold || false,
           italic: false
         };
       } else if (l.type === 'shape') {
         gl.shape = {
           type: 'rectangle', // simplified
           fill: l.fill,
           stroke: l.stroke,
           strokeWidth: 0
         };
         // hacky mapping width/height to scale for rects
         gl.transform.scaleX = l.w / 100;
         gl.transform.scaleY = l.h / 100;
       }
       return gl;
    });

    const newClip: VideoClip = {
      id: crypto.randomUUID(),
      name: template.name,
      url: '',
      type: 'graphic',
      duration: 5,
      startTime: state.currentTime,
      sourceStart: 0,
      sourceEnd: 5,
      volume: 1,
      speed: 1,
      trackIndex: 2,
      locked: false,
      transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 },
      graphic: {
         templateId: template.id,
         layers: graphicLayers
      }
    };

    setState(prev => ({ ...prev, clips: [...prev.clips, newClip] }));
  };

  return (
    <div className="space-y-4 px-2">
       <div className="relative mb-3 group">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
          <Search size={10} />
        </div>
        <input 
          type="text"
          placeholder="SEARCH TEMPLATES..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-[8px] font-bold uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700 text-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pb-4">
        {TEMPLATES.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map((t) => (
           <div 
             key={t.id}
             onClick={() => handleApply(t)}
             className="bg-black/60 border border-white/10 rounded overflow-hidden cursor-pointer hover:border-blue-500 hover:bg-blue-900/20 transition-all flex flex-col items-center justify-center py-6 gap-2"
           >
              <div className="text-gray-400">{t.icon}</div>
              <span className="text-[9px] font-bold tracking-widest text-white uppercase text-center px-1">{t.name}</span>
           </div>
        ))}
      </div>
    </div>
  );
}
