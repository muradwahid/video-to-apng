import React, { useState } from 'react';
import { useColorStore } from '../store/useColorStore';
import { cn } from '../lib/utils';
import { Sliders, Sun, Palette, Aperture, Layers, CircleDot } from 'lucide-react';
import { PropertyInspector } from './PropertyInspector';

interface ColorPanelProps {
  clipId: string;
}

function SliderProperty({ label, value, min, max, step, onChange, title }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, title?: string }) {
  return (
    <div className="space-y-2" title={title}>
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-medium text-gray-400">{label}</label>
        <span className="text-[10px] font-mono text-blue-500 font-bold">{value.toFixed(1)}</span>
      </div>
      <input 
        type="range" 
        min={min} max={max} step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/5 rounded-full accent-blue-500 cursor-pointer hover:bg-white/10 transition-colors"
      />
    </div>
  );
}

// A simple draggable color wheel puck
function ColorWheel({ label, value, onChange }: { label: string, value: [number, number, number], onChange: (val: [number, number, number]) => void }) {
  const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    // simplified interaction: just mapping click/drag to [-1, 1] for x and y
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const dist = Math.min(1, Math.sqrt(x*x + y*y));
    const angle = Math.atan2(y, x);
    // r, g, b from angle and dist
    const r = Math.cos(angle) * dist;
    const g = Math.cos(angle - Math.PI * 2 / 3) * dist;
    const b = Math.cos(angle + Math.PI * 2 / 3) * dist;
    onChange([r, g, b]);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] uppercase text-gray-400 font-bold tracking-widest">{label}</div>
      <div 
         className="w-24 h-24 rounded-full border-2 border-white/10 relative overflow-hidden cursor-crosshair"
         style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
         onMouseDown={(e) => {
           handleDrag(e);
           const move = (em: MouseEvent) => handleDrag(em as any);
           const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
           window.addEventListener('mousemove', move);
           window.addEventListener('mouseup', up);
         }}
      >
        <div className="absolute inset-0 bg-black/50 rounded-full pointer-events-none"></div>
        {/* Puck */}
        <div 
          className="absolute w-3 h-3 bg-white border-2 border-black rounded-full pointer-events-none"
          style={{
            top: `calc(50% + ${((value[0] + value[1] + value[2]) / 3) * 40}px)`, 
            left: `calc(50% + ${((value[1] - value[2]) / 2) * 40}px)`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
    </div>
  );
}

// A simple SVG curve editor
function CurveEditor({ curve, onChange }: { curve: [number, number][], onChange: (val: [number, number][]) => void }) {
  return (
    <div className="aspect-square bg-black border border-white/10 rounded relative w-full overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0">
         <polyline 
           points={curve.map(pt => `${pt[0]*100},${100 - pt[1]*100}`).join(' ')} 
           fill="none" stroke="white" strokeWidth="2" 
         />
         {curve.map((pt, i) => (
           <circle 
             key={i} cx={pt[0]*100} cy={100 - pt[1]*100} r="3" fill="blue" 
             className="cursor-pointer"
           />
         ))}
      </svg>
      {/* Grid */}
      <div className="pointer-events-none absolute inset-0 grid grid-cols-4 grid-rows-4 border-white/5 divide-x divide-y divide-white/5">
        {Array.from({length: 16}).map((_, i) => <div key={i} />)}
      </div>
    </div>
  );
}


export function ColorPanel({ clipId }: ColorPanelProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'creative' | 'curves' | 'wheels' | 'secondary' | 'vignette'>('basic');
  const grade = useColorStore(s => s.getGrade(clipId));
  const updateGrade = useColorStore(s => s.updateGrade);

  const setParams = (updates: Partial<typeof grade>) => {
    updateGrade(clipId, updates);
  };

  const tabs = [
    { id: 'basic', label: 'Basic', icon: Sun },
    { id: 'creative', label: 'Creative', icon: Palette },
    { id: 'curves', label: 'Curves', icon: Sliders },
    { id: 'wheels', label: 'Wheels', icon: CircleDot },
    { id: 'secondary', label: 'HSL', icon: Layers },
    { id: 'vignette', label: 'Vignette', icon: Aperture },
  ] as const;

  return (
    <div className="flex flex-col gap-4 max-h-full h-full">
      <div className="flex flex-wrap gap-1 px-1 bg-[#1A1A1A] p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center p-1.5 flex-1 rounded text-[8px] font-bold uppercase tracking-widest gap-1 transition-all",
              activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"
            )}
            title={tab.label}
          >
            <tab.icon size={10} />
            <span className="sr-only sm:not-sr-only overflow-hidden xl:inline">{tab.id}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-1 pr-2 pb-4 space-y-6 custom-scrollbar">
        {activeTab === 'basic' && (
           <div className="space-y-4">
             <div className="p-3 bg-white/5 rounded space-y-3">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/5 pb-2 mb-2">White Balance</h3>
               <SliderProperty label="Temperature" value={grade.temperature} min={-1} max={1} step={0.01} onChange={(v) => setParams({temperature: v})} />
               <SliderProperty label="Tint" value={grade.tint} min={-1} max={1} step={0.01} onChange={(v) => setParams({tint: v})} />
             </div>
             <div className="p-3 bg-white/5 rounded space-y-3">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/5 pb-2 mb-2">Tone</h3>
               <SliderProperty label="Exposure" value={grade.exposure} min={-2} max={2} step={0.01} onChange={(v) => setParams({exposure: v})} />
               <SliderProperty label="Contrast" value={grade.contrast} min={-1} max={1} step={0.01} onChange={(v) => setParams({contrast: v})} />
               <SliderProperty label="Highlights" value={grade.highlights} min={-1} max={1} step={0.01} onChange={(v) => setParams({highlights: v})} />
               <SliderProperty label="Shadows" value={grade.shadows} min={-1} max={1} step={0.01} onChange={(v) => setParams({shadows: v})} />
               <SliderProperty label="Whites" value={grade.whites} min={-1} max={1} step={0.01} onChange={(v) => setParams({whites: v})} />
               <SliderProperty label="Blacks" value={grade.blacks} min={-1} max={1} step={0.01} onChange={(v) => setParams({blacks: v})} />
             </div>
             <div className="p-3 bg-white/5 rounded space-y-3">
               <SliderProperty label="Saturation" value={grade.saturation} min={0} max={3} step={0.01} onChange={(v) => setParams({saturation: v})} />
             </div>
           </div>
        )}

        {activeTab === 'creative' && (
           <div className="space-y-4">
             <div className="p-3 bg-white/5 rounded space-y-3">
               <SliderProperty label="Faded Film" value={grade.fadedFilm} min={0} max={100} step={1} onChange={(v) => setParams({fadedFilm: v})} />
               <SliderProperty label="Sharpen" value={grade.sharpen} min={0} max={100} step={1} onChange={(v) => setParams({sharpen: v})} />
               <SliderProperty label="Vibrance" value={grade.vibrance} min={-100} max={100} step={1} onChange={(v) => setParams({vibrance: v})} />
             </div>
             <div className="p-3 bg-white/5 rounded space-y-3 mt-4">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/5 pb-2 mb-2">LUT (Look)</h3>
               <select 
                 className="w-full bg-[#0A0A0A] border border-white/5 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                 onChange={(e) => setParams({ lutUrl: e.target.value })}
                 value={grade.lutUrl || ""}
               >
                 <option value="">None</option>
                 <option value="cinematic">Cinematic Rec.709</option>
                 <option value="tealOrange">Teal & Orange</option>
                 <option value="vintage">Vintage Film</option>
               </select>
               <SliderProperty label="Intensity" value={grade.lutIntensity} min={0} max={100} step={1} onChange={(v) => setParams({lutIntensity: v})} />
             </div>
           </div>
        )}

        {activeTab === 'curves' && (
           <div className="space-y-4">
             <div className="p-3 bg-white/5 rounded space-y-3">
               <CurveEditor curve={grade.curveRGB} onChange={(c) => setParams({curveRGB: c})} />
             </div>
           </div>
        )}

        {activeTab === 'wheels' && (
           <div className="space-y-4">
             <div className="flex flex-row justify-between p-3 bg-white/5 rounded gap-2">
                 <ColorWheel label="Lift" value={grade.lift} onChange={(v) => setParams({lift: v})} />
                 <ColorWheel label="Gamma" value={grade.gamma} onChange={(v) => setParams({gamma: v})} />
                 <ColorWheel label="Gain" value={grade.gain} onChange={(v) => setParams({gain: v})} />
             </div>
           </div>
        )}

        {activeTab === 'secondary' && (
           <div className="space-y-4">
             <div className="p-3 bg-white/5 rounded space-y-3">
               <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/5 pb-2 mb-2">HSL Secondary</h3>
               <SliderProperty label="Target Hue" value={grade.secondaryHue} min={0} max={360} step={1} onChange={(v) => setParams({secondaryHue: v})} />
               <SliderProperty label="Hue Range" value={grade.secondaryRange} min={0} max={1} step={0.01} onChange={(v) => setParams({secondaryRange: v})} />
               
               <div className="mt-4 pt-4 border-t border-white/5">
                 <SliderProperty label="Adjust Saturation" value={grade.secondarySaturation} min={-1} max={1} step={0.01} onChange={(v) => setParams({secondarySaturation: v})} />
                 <SliderProperty label="Adjust Lightness" value={grade.secondaryLightness} min={-1} max={1} step={0.01} onChange={(v) => setParams({secondaryLightness: v})} />
               </div>

               <div className="flex items-center gap-2 mt-4 pt-4">
                 <input type="checkbox" checked={grade.secondaryMask} onChange={e => setParams({secondaryMask: e.target.checked})} />
                 <span className="text-xs text-gray-400">Show Mask</span>
               </div>
             </div>
           </div>
        )}

        {activeTab === 'vignette' && (
           <div className="space-y-4">
             <div className="p-3 bg-white/5 rounded space-y-3">
               <SliderProperty label="Amount" value={grade.vignetteAmount} min={0} max={100} step={1} onChange={(v) => setParams({vignetteAmount: v})} />
               <SliderProperty label="Midpoint" value={grade.vignetteMidpoint} min={0} max={100} step={1} onChange={(v) => setParams({vignetteMidpoint: v})} />
               <SliderProperty label="Roundness" value={grade.vignetteRoundness} min={0} max={100} step={1} onChange={(v) => setParams({vignetteRoundness: v})} />
               <SliderProperty label="Feather" value={grade.vignetteFeather} min={0} max={100} step={1} onChange={(v) => setParams({vignetteFeather: v})} />
             </div>
           </div>
        )}

      </div>
    </div>
  );
}
