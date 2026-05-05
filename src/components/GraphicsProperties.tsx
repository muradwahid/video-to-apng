import React from 'react';
import { TimelineState } from '../types';
import { InspectorSection, SliderProperty, SwitchProperty } from './PropertyInspector';
import { Settings, Image, Type, Square, Copy, Trash, Sparkles } from 'lucide-react';

export function GraphicsProperties({ state, setState }: { state: TimelineState, setState: React.Dispatch<React.SetStateAction<TimelineState>> }) {
  const selectedClip = (state.clips || []).find(c => c.id === state.selectedClipId);
  
  if (!selectedClip || (selectedClip.type !== 'text' && selectedClip.type !== 'graphic' && selectedClip.type !== 'caption')) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-50 px-4 text-center text-gray-400">
         <Settings size={24} className="mb-2" />
         <span className="text-[10px] font-bold uppercase tracking-widest">Select a Text or Graphic clip</span>
      </div>
    );
  }

  const isText = selectedClip.type === 'text' || selectedClip.type === 'caption';
  
  return (
    <div className="space-y-4">
       {isText && (
         <InspectorSection title="Text Properties" icon={<Type size={12} />}>
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-gray-400">Content</label>
              <textarea 
                 value={selectedClip.text?.content || ''}
                 onChange={(e) => {
                   const val = e.target.value;
                   setState(prev => ({
                     ...prev,
                     clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), content: val } } : c)
                   }))
                 }}
                 className="w-full text-[11px] bg-black/50 border border-white/10 rounded p-2 text-white h-20 outline-none"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="space-y-1">
                 <label className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Font Family</label>
                 <select className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white"
                   value={selectedClip.text?.fontFamily || 'Inter'}
                   onChange={(e) => {
                     const val = e.target.value;
                     setState(prev => ({
                       ...prev,
                       clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), fontFamily: val } } : c)
                     }))
                   }}
                 >
                   <option value="Inter">Inter</option>
                   <option value="Roboto">Roboto</option>
                   <option value="Oswald">Oswald</option>
                   <option value="Playfair Display">Playfair Display</option>
                 </select>
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Color</label>
                 <input type="color" className="w-full h-6 rounded bg-transparent border-none cursor-pointer"
                   value={selectedClip.text?.color || '#ffffff'}
                   onChange={(e) => {
                     const val = e.target.value;
                     setState(prev => ({
                       ...prev,
                       clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), color: val } } : c)
                     }))
                   }}
                 />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
               <SliderProperty 
                 label="Size" 
                 value={selectedClip.text?.fontSize || 32} 
                 min={8} max={200} step={1}
                 onChange={(v) => {
                    setState(prev => ({
                       ...prev,
                       clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), fontSize: v } } : c)
                     }))
                 }}
               />
               <SliderProperty 
                 label="Letter Spacing" 
                 value={selectedClip.text?.letterSpacing || 0} 
                 min={-10} max={100} step={1}
                 onChange={(v) => {
                    setState(prev => ({
                       ...prev,
                       clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), letterSpacing: v } } : c)
                     }))
                 }}
               />
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-2">
               <div className="flex gap-1">
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), align: 'left'} } : c)}))} className={`flex-1 py-1 rounded text-xs font-bold ${selectedClip.text?.align === 'left' ? 'bg-blue-600' : 'bg-white/10'}`}>L</button>
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), align: 'center'} } : c)}))} className={`flex-1 py-1 rounded text-xs font-bold ${selectedClip.text?.align === 'center' ? 'bg-blue-600' : 'bg-white/10'}`}>C</button>
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), align: 'right'} } : c)}))} className={`flex-1 py-1 rounded text-xs font-bold ${selectedClip.text?.align === 'right' ? 'bg-blue-600' : 'bg-white/10'}`}>R</button>
               </div>
               <div className="flex gap-1">
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), bold: !c.text?.bold} } : c)}))} className={`flex-1 py-1 rounded text-xs font-serif font-bold ${selectedClip.text?.bold ? 'bg-blue-600' : 'bg-white/10'}`}>B</button>
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), italic: !c.text?.italic} } : c)}))} className={`flex-1 py-1 rounded text-xs font-serif italic ${selectedClip.text?.italic ? 'bg-blue-600' : 'bg-white/10'}`}>I</button>
                  <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, text: { ...(c.text as any), underline: !c.text?.underline} } : c)}))} className={`flex-1 py-1 rounded text-xs font-serif underline ${selectedClip.text?.underline ? 'bg-blue-600' : 'bg-white/10'}`}>U</button>
               </div>
            </div>
         </InspectorSection>
       )}
       {isText && (
         <InspectorSection title="Appearance" icon={<Sparkles size={12} />}>
            <SwitchProperty 
               label="Stroke" 
               checked={!!selectedClip.text?.stroke} 
               onChange={(c) => {
                  setState(prev => ({
                     ...prev,
                     clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), stroke: c ? { color: '#000000', width: 2 } : undefined } } : cl)
                  }))
               }}
            />
            {selectedClip.text?.stroke && (
               <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                     <label className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Stroke Color</label>
                     <input type="color" className="w-full h-6 rounded bg-transparent border-none cursor-pointer"
                       value={selectedClip.text?.stroke.color || '#000000'}
                       onChange={(e) => {
                         const val = e.target.value;
                         setState(prev => ({
                           ...prev,
                           clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), stroke: { ...cl.text!.stroke!, color: val } } } : cl)
                         }))
                       }}
                     />
                  </div>
                  <SliderProperty 
                    label="Width" 
                    value={selectedClip.text?.stroke.width || 2} 
                    min={1} max={20} step={1}
                    onChange={(v) => {
                       setState(prev => ({
                          ...prev,
                          clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), stroke: { ...cl.text!.stroke!, width: v } } } : cl)
                        }))
                    }}
                  />
               </div>
            )}
            
            <div className="mt-4" />
            
            <SwitchProperty 
               label="Background Box" 
               checked={!!selectedClip.text?.backgroundColor} 
               onChange={(c) => {
                  setState(prev => ({
                     ...prev,
                     clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), backgroundColor: c ? 'rgba(0,0,0,0.5)' : undefined } } : cl)
                  }))
               }}
            />

            <div className="mt-4" />

            <SwitchProperty 
               label="Drop Shadow" 
               checked={!!selectedClip.text?.shadow} 
               onChange={(c) => {
                  setState(prev => ({
                     ...prev,
                     clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), shadow: c ? { color: 'rgba(0,0,0,0.8)', angle: 45, distance: 5, blur: 5 } : undefined } } : cl)
                  }))
               }}
            />
            {selectedClip.text?.shadow && (
               <div className="grid grid-cols-2 gap-2 mt-2">
                  <SliderProperty 
                    label="Distance" 
                    value={selectedClip.text?.shadow.distance || 5} 
                    min={0} max={50} step={1}
                    onChange={(v) => {
                       setState(prev => ({
                          ...prev,
                          clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), shadow: { ...cl.text!.shadow!, distance: v } } } : cl)
                        }))
                    }}
                  />
                  <SliderProperty 
                    label="Blur" 
                    value={selectedClip.text?.shadow.blur || 5} 
                    min={0} max={50} step={1}
                    onChange={(v) => {
                       setState(prev => ({
                          ...prev,
                          clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), shadow: { ...cl.text!.shadow!, blur: v } } } : cl)
                        }))
                    }}
                  />
               </div>
            )}

            <div className="mt-4" />

            <div className="space-y-4">
               <div>
                 <SliderProperty 
                   label="3D Depth" 
                   value={selectedClip.text?.depth || 0} 
                   min={0} max={30} step={1}
                   onChange={(v) => {
                      setState(prev => ({
                         ...prev,
                         clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), depth: v } } : cl)
                       }))
                   }}
                 />
               </div>
               {selectedClip.text?.depth && selectedClip.text.depth > 0 ? (
                 <div>
                   <SliderProperty 
                     label="3D Perspective" 
                     value={selectedClip.text?.perspective || 0} 
                     min={-50} max={50} step={1}
                     onChange={(v) => {
                        setState(prev => ({
                           ...prev,
                           clips: prev.clips.map(cl => cl.id === selectedClip.id ? { ...cl, text: { ...(cl.text as any), perspective: v } } : cl)
                         }))
                     }}
                   />
                 </div>
               ) : null}
            </div>
         </InspectorSection>
       )}

       {isText && (
         <InspectorSection title="Quick Actions" icon={<Settings size={12} />}>
            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, transform: { ...c.transform, x: 0, y: 0 } } : c)}))} className="py-2 bg-white/10 hover:bg-white/20 rounded text-[10px] uppercase font-bold tracking-widest text-center transition-colors">Center</button>
               <button onClick={() => setState(prev => ({ ...prev, clips: prev.clips.map(c => c.id === selectedClip.id ? { ...c, transform: { ...c.transform, scale: 1, x: 0, y: 0, rotation: 0 } } : c)}))} className="py-2 bg-white/10 hover:bg-white/20 rounded text-[10px] uppercase font-bold tracking-widest text-center transition-colors">Reset</button>
            </div>
         </InspectorSection>
       )}
    </div>
  );
}
