import React from 'react';
import { TimelineState, VideoClip } from '../types';
import { audioEngine } from '../services/audioEngine';
import { 
  Sun, Contrast, Droplets, Sparkles, Wind, Volume2, 
  MoveHorizontal, Maximize2, RotateCw, FastForward, 
  Scissors as Scissor, Sliders, Zap, Monitor, Info, FlipHorizontal, FlipVertical, Lock, Unlock, Loader2, Crop as CropIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ColorPanel } from './ColorPanel';
import { EffectControls } from './EffectControls';
import { EssentialSound } from './EssentialSound';

import { GraphicsProperties } from './GraphicsProperties';
import { GraphicsPanel } from './GraphicsPanel';
import { CaptionsPanel } from './CaptionsPanel';

interface PropertyInspectorProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  activeTab: "media" | "effects" | "color" | "audio" | "export" | "graphics" | "captions";
  onToggleCrop?: () => void;
  isCropping?: boolean;
}

export function SwitchProperty({ label, checked, onChange, tooltip }: { label: string, checked: boolean, onChange: (c: boolean) => void, tooltip?: string }) {
  return (
    <div className="flex items-center justify-between" title={tooltip}>
      <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</label>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${checked ? 'bg-blue-500' : 'bg-white/10'}`}
      >
        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

export function SliderProperty({ label, value, min, max, step, onChange, title }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, title?: string }) {
  return (
    <div className="space-y-2" title={title}>
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-medium text-gray-400">{label}</label>
        <span className="text-[10px] font-mono text-blue-500 font-bold">{value.toFixed(2)}</span>
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

export function PropertyInspector({ state, setState, activeTab, onToggleCrop, isCropping }: PropertyInspectorProps) {
  const selectedClip = (state.clips || []).find(c => c.id === state.selectedClipId);
  const selectedAsset = selectedClip ? (state.assets || []).find(a => a.url === selectedClip.url) : null;

  const updateTransform = (key: string, value: any) => {
    if (!state.selectedClipId) return;
    setState(prev => {
      const selected = prev.clips.find(c => c.id === prev.selectedClipId);
      if (!selected) return prev;
      const groupId = selected.groupId;

      // Special case for primitive number values where we might want to apply a delta
      const isNum = typeof value === 'number';
      const origSelectedVal = isNum ? (selected.transform as any)[key] ?? (key === 'scale' || key === 'opacity' ? 1 : 0) : 0;
      const delta = isNum ? value - origSelectedVal : 0;

      return {
        ...prev,
        clips: prev.clips.map(c => {
          if (c.id === selected.id) {
            return {
              ...c,
              transform: {
                ...(c.transform || {}),
                [key]: value
              }
            };
          }
          if (groupId && c.groupId === groupId) {
            const newTransform = { ...(c.transform || {}) } as any;
            const origCVal = (c.transform as any)[key] ?? (key === 'scale' || key === 'opacity' ? 1 : 0);
            
            if (key === 'scale') {
               const origScale = selected.transform?.scale ?? 1;
               const scaleFactor = origScale === 0 ? 1 : (value as number) / origScale;
               const pivotX = selected.transform?.x ?? 0;
               const pivotY = selected.transform?.y ?? 0;
               
               newTransform.scale = Math.max(0.01, origCVal * scaleFactor);
               newTransform.x = pivotX + ((c.transform?.x ?? 0) - pivotX) * scaleFactor;
               newTransform.y = pivotY + ((c.transform?.y ?? 0) - pivotY) * scaleFactor;
            } else if (key === 'rotation') {
               const pivotX = selected.transform?.x ?? 0;
               const pivotY = selected.transform?.y ?? 0;
               const cx = c.transform?.x ?? 0;
               const cy = c.transform?.y ?? 0;
               const dx = cx - pivotX;
               const dy = cy - pivotY;
               const deltaRad = (delta * Math.PI) / 180;
               
               newTransform.rotation = origCVal + delta;
               newTransform.x = pivotX + (dx * Math.cos(deltaRad) - dy * Math.sin(deltaRad));
               newTransform.y = pivotY + (dx * Math.sin(deltaRad) + dy * Math.cos(deltaRad));
            } else if (key === 'x' || key === 'y' || key === 'opacity') {
               newTransform[key] = origCVal + delta;
               if (key === 'opacity') newTransform.opacity = Math.max(0, Math.min(1, newTransform.opacity));
            } else if (isNum && key !== 'mask' && key !== 'dropShadow' && key !== 'crop') {
               newTransform[key] = origCVal + delta;
            } else {
               newTransform[key] = value;
            }

            return { ...c, transform: newTransform };
          }
          return c;
        })
      };
    });
  };

  const addKeyframe = () => {
    if (!state.selectedClipId || !selectedClip) return;
    const relTime = state.currentTime - selectedClip.startTime;
    if (relTime < 0 || relTime > selectedClip.duration) return;
    
    // We get current interpolated transform at this time to bake it in
    // However, to keep it simple, we just read the current base transform OR the interpolated one
    // But since PropertyInspector doesn't evaluate interpolation itself here, we'll just snap the base values.
    // In a real app we'd want to use getInterpolatedTransform, but here we just copy the base properties for a new keyframe or let user type.
    const newKf = {
      id: Math.random().toString(36).substr(2,9),
      time: relTime,
      properties: {
        x: selectedClip.transform.x || 0,
        y: selectedClip.transform.y || 0,
        scale: selectedClip.transform.scale || 1,
        rotation: selectedClip.transform.rotation || 0,
        opacity: selectedClip.transform.opacity ?? 1
      },
      easing: 'ease-in-out' as const
    };

    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        if (c.id !== prev.selectedClipId) return c;
        const keyframes = [...(c.keyframes || [])];
        // Check if one exists close to this time and replace it
        const idx = keyframes.findIndex(k => Math.abs(k.time - relTime) < 0.1);
        if (idx >= 0) {
          keyframes[idx] = { ...keyframes[idx], ...newKf, id: keyframes[idx].id };
        } else {
          keyframes.push(newKf);
        }
        return { ...c, keyframes };
      })
    }));
  };

  const removeKeyframe = (id: string) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        if (c.id !== prev.selectedClipId) return c;
        return { ...c, keyframes: (c.keyframes || []).filter(k => k.id !== id) };
      })
    }));
  };

  const updateKeyframe = (id: string, updates: any) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        if (c.id !== prev.selectedClipId) return c;
        return {
          ...c,
          keyframes: (c.keyframes || []).map(k => k.id === id ? { ...k, ...updates } : k)
        };
      })
    }));
  };

  const updateClipProp = (key: string, value: any) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === prev.selectedClipId ? { ...c, [key]: value } : c)
    }));
  };

  const updateFilter = (filter: string, value: number) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === prev.selectedClipId ? {
        ...c,
        filters: {
          brightness: 1, contrast: 1, saturation: 1, blur: 0, grayscale: 0, sepia: 0, invert: 0, hueRotate: 0,
          vignette: 0, grain: 0,
          ...(c.filters || {}),
          [filter]: value
        }
      } : c)
    }));
  };

  const updateCutout = (key: string, value: any) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === prev.selectedClipId ? {
        ...c,
        cutout: {
          enabled: false,
          type: 'chroma',
          keyColor: '#00ff00',
          similarity: 0.1,
          smoothness: 0.1,
          ...(c.cutout || {}),
          [key]: value
        }
      } : c)
    }));
  };

  const updateAudio = (key: string, value: any, nestedKey?: string) => {
    if (!state.selectedClipId) return;
    setState(prev => {
      const newClips = prev.clips.map(c => {
        if (c.id !== prev.selectedClipId) return c;
        const audio = {
          volume: 1, fadeIn: 0, fadeOut: 0, muted: false, pan: 0,
          eq: { low: 0, mid: 0, high: 0 },
          effects: { reverb: 0, delay: 0, pitch: 0 },
          ...(c.audio || {})
        };
        
        if (nestedKey) {
          (audio as any)[key] = { ...(audio as any)[key], [nestedKey]: value };
        } else {
          (audio as any)[key] = value;
        }

        const newClip = { ...c, audio };
        // Real-time audio update
        audioEngine.updateClipAudio(newClip);
        return newClip;
      });
      return { ...prev, clips: newClips };
    });
  };

  const [isProcessingAI, setIsProcessingAI] = React.useState<string | null>(null);

  const handleAIAction = async (action: string) => {
    if (!state.selectedClipId || !selectedClip) return;
    
    if (action === 'Noise Removal') {
      setIsProcessingAI('Noise Removal');
      // Simulate AI analysis delay
      setTimeout(() => {
        updateAudio('aiNoiseReduction', !(selectedClip.audio?.aiNoiseReduction));
        setIsProcessingAI(null);
      }, 1500);
      return;
    }
    
    alert(`Triggering AI ${action} for selected clip. This would use Gemini API for processing.`);
  };

  const selectedTransition = (state.transitions || []).find(t => t.id === state.selectedTransitionId);

  if (selectedTransition) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <InspectorSection title="Transition Settings" icon={<MoveHorizontal size={12} />}>
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-1">{selectedTransition.type.replace('-', ' ')}</h4>
            <p className="text-[9px] text-blue-300/70 uppercase">Between Clips</p>
          </div>
          
          <SliderProperty 
            label="Duration (s)" 
            value={selectedTransition.duration} 
            min={0.1} max={5} step={0.1}
            onChange={(v) => {
              setState(prev => ({
                ...prev,
                transitions: prev.transitions.map(t => t.id === selectedTransition.id ? { ...t, duration: v } : t)
              }));
            }} 
            title="How long the transition takes"
          />

          <div className="space-y-2 mt-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Easing Curve</label>
            <select 
              value={selectedTransition.easing || 'linear'}
              onChange={(e) => {
                setState(prev => ({
                  ...prev,
                  transitions: prev.transitions.map(t => t.id === selectedTransition.id ? { ...t, easing: e.target.value as any } : t)
                }));
              }}
              className="w-full bg-[#1A1A1A] border border-white/10 text-white text-xs py-1.5 px-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="linear">Linear (Constant Speed)</option>
              <option value="ease-in">Ease In (Accelerate)</option>
              <option value="ease-out">Ease Out (Decelerate)</option>
              <option value="ease-in-out">Ease In Out (Smooth)</option>
            </select>
          </div>
        </InspectorSection>
      </div>
    );
  }

  if (state.selectedClipIds.length > 1) {
    return (
      <div className="flex flex-col gap-6 pb-4">
        <InspectorSection title={`Batch Edit (${state.selectedClipIds.length} Clips)`} icon={<Info size={12} />}>
           <div className="space-y-4">
              <p className="text-[10px] text-gray-400 mb-2">You have selected {state.selectedClipIds.length} clips. Apply changes carefully.</p>
              
              <div className="space-y-2">
                 <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Apply Tag / Label</label>
                 <select 
                   onChange={(e) => {
                     const label = e.target.value;
                     if (!label) return;
                     setState(prev => ({
                        ...prev,
                        assets: prev.assets.map(a => {
                           const isSelectedAsset = (prev.clips || []).some(c => state.selectedClipIds.includes(c.id) && c.url === a.url);
                           if (!isSelectedAsset) return a;
                           const existingLabels = a.metadata?.labels || [];
                           if (existingLabels.includes(label)) return a;
                           return { ...a, metadata: { ...a.metadata, labels: [...existingLabels, label] } };
                        })
                     }));
                     e.target.value = ''; // reset
                   }}
                   className="w-full bg-[#1A1A1A] border-white/10 text-white text-xs py-1.5 px-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                 >
                   <option value="">Select a label to apply...</option>
                   <option value="Approved">Approved</option>
                   <option value="Needs Review">Needs Review</option>
                   <option value="B-Roll">B-Roll</option>
                   <option value="Interview">Interview</option>
                 </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button 
                  onClick={() => {
                     setState(prev => ({
                        ...prev,
                        clips: (prev.clips || []).map(c => state.selectedClipIds.includes(c.id) ? { ...c, locked: true } : c)
                     }));
                  }}
                  className="flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded border bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Lock size={12} /> Lock All
                </button>
                <button 
                  onClick={() => {
                     setState(prev => ({
                        ...prev,
                        clips: (prev.clips || []).map(c => state.selectedClipIds.includes(c.id) ? { ...c, locked: false } : c)
                     }));
                  }}
                  className="flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded border bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Unlock size={12} /> Unlock
                </button>
              </div>
           </div>
        </InspectorSection>
      </div>
    );
  }

  if (!selectedClip && activeTab !== "export") {
    if (activeTab === "captions") {
      return <CaptionsPanel state={state} setState={setState} />;
    }
    if (activeTab === "graphics") {
      return <GraphicsPanel state={state} setState={setState} />;
    }
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-4">
        <Wind className="h-12 w-12 mb-4" />
        <h3 className="text-[10px] font-bold uppercase tracking-widest">Select a clip to edit properties</h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-4">
      {activeTab === "media" && (
        <div className="space-y-6">
          <InspectorSection title="General" icon={<Info size={12} />}>
            <div className="flex gap-2">
              <button 
                onClick={() => updateClipProp('locked', !(selectedClip?.locked ?? false))}
                className={cn("flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded border transition-all flex items-center justify-center gap-2", selectedClip?.locked ? "bg-red-600 border-red-400 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white")}
              >
                {selectedClip?.locked ? <Lock size={12} /> : <Unlock size={12} />}
                {selectedClip?.locked ? "Clip Locked" : "Lock Clip"}
              </button>
            </div>
            
            <div className="mt-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Track / Layer (Z-Index)</label>
              <select 
                value={selectedClip?.trackIndex ?? 0}
                onChange={(e) => updateClipProp('trackIndex', parseInt(e.target.value))}
                className="w-full bg-[#1A1A1A] border-white/10 text-white text-xs py-1.5 px-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={0}>Video 1 (Base Layer)</option>
                <option value={1}>Overlay (B-Roll / PIP)</option>
                <option value={2}>Music</option>
                <option value={3}>Voice / SFX</option>
              </select>
            </div>
          </InspectorSection>

          {selectedClip?.type === 'text' && selectedClip.text && (
            <InspectorSection title="Text Settings" icon={<Info size={12} />}>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Content</label>
                  <textarea 
                    value={selectedClip.text.content}
                    onChange={(e) => updateClipProp('text', { ...selectedClip.text, content: e.target.value })}
                    className="w-full bg-[#1A1A1A] border border-white/10 text-white text-xs py-1.5 px-2 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Font Family</label>
                    <select 
                      value={selectedClip.text.fontFamily}
                      onChange={(e) => updateClipProp('text', { ...selectedClip.text, fontFamily: e.target.value })}
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white text-[10px] py-1 px-1 rounded"
                    >
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                      <option value="'Courier New', Courier, monospace">Courier New</option>
                      <option value="Impact, sans-serif">Impact</option>
                      <option value="Comic Sans MS, cursive">Comic Sans</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Font Size</label>
                    <input 
                      type="number" 
                      value={selectedClip.text.fontSize} 
                      onChange={(e) => updateClipProp('text', { ...selectedClip.text, fontSize: parseInt(e.target.value) || 24 })} 
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white text-[10px] py-1 px-1 rounded" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Color</label>
                    <input 
                      type="color" 
                      value={selectedClip.text.color} 
                      onChange={(e) => updateClipProp('text', { ...selectedClip.text, color: e.target.value })} 
                      className="w-full h-6 rounded cursor-pointer" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Background</label>
                    <input 
                      type="color" 
                      value={selectedClip.text.backgroundColor || "#000000"} 
                      onChange={(e) => updateClipProp('text', { ...selectedClip.text, backgroundColor: e.target.value })} 
                      className="w-3/4 h-6 rounded cursor-pointer inline-block align-middle" 
                    />
                    <input 
                      type="checkbox" 
                      checked={!!selectedClip.text.backgroundColor}
                      onChange={(e) => updateClipProp('text', { ...selectedClip.text, backgroundColor: e.target.checked ? '#000000' : undefined })}
                      className="w-1/4 inline-block align-middle ml-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => updateClipProp('text', { ...selectedClip.text, bold: !selectedClip.text?.bold })}
                     className={cn("flex-1 py-1 text-xs font-bold rounded", selectedClip.text.bold ? "bg-blue-600 text-white" : "bg-white/10 text-gray-400")}
                   >
                     B
                   </button>
                   <button 
                     onClick={() => updateClipProp('text', { ...selectedClip.text, italic: !selectedClip.text?.italic })}
                     className={cn("flex-1 py-1 text-xs italic font-serif rounded", selectedClip.text.italic ? "bg-blue-600 text-white" : "bg-white/10 text-gray-400")}
                   >
                     I
                   </button>
                   <select 
                     value={selectedClip.text.align}
                     onChange={(e) => updateClipProp('text', { ...selectedClip.text, align: e.target.value })}
                     className="flex-2 bg-[#1A1A1A] border border-white/10 text-white text-[10px] py-1 px-1 rounded"
                   >
                     <option value="left">Left</option>
                     <option value="center">Center</option>
                     <option value="right">Right</option>
                   </select>
                </div>
              </div>
            </InspectorSection>
          )}
          
          <InspectorSection title="Transform" icon={<Maximize2 size={12} />}>
            <SliderProperty 
              label="Position X" 
              value={selectedClip?.transform?.x ?? 0} 
              min={-2000} max={2000} step={1}
              onChange={(v) => updateTransform('x', v)} 
              title="Move the media horizontally (in pixels)"
            />
            <SliderProperty 
              label="Position Y" 
              value={selectedClip?.transform?.y ?? 0} 
              min={-2000} max={2000} step={1}
              onChange={(v) => updateTransform('y', v)} 
              title="Move the media vertically (in pixels)"
            />
            <SliderProperty 
              label="Scale" 
              value={selectedClip?.transform?.scale ?? 1} 
              min={0.1} max={3} step={0.01}
              onChange={(v) => updateTransform('scale', v)} 
              title="Resize the media visually on the canvas"
            />
            <SliderProperty 
              label="Rotation" 
              value={selectedClip?.transform?.rotation ?? 0} 
              min={-180} max={180} step={1}
              onChange={(v) => updateTransform('rotation', v)} 
              title="Rotate the media in degrees"
            />
            <SliderProperty 
              label="Opacity" 
              value={selectedClip?.transform?.opacity ?? 1} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateTransform('opacity', v)} 
              title="Change the transparency of the media"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => updateTransform('flipX', !(selectedClip?.transform?.flipX ?? false))}
                className={cn("flex-1 py-1 px-2 text-[8px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", selectedClip?.transform?.flipX ? "bg-blue-600 border-blue-400" : "bg-white/5 border-white/5 text-gray-400")}
              >
                <FlipHorizontal size={10} /> Flip X
              </button>
              <button 
                onClick={() => updateTransform('flipY', !(selectedClip?.transform?.flipY ?? false))}
                className={cn("flex-1 py-1 px-2 text-[8px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", selectedClip?.transform?.flipY ? "bg-blue-600 border-blue-400" : "bg-white/5 border-white/5 text-gray-400")}
              >
                <FlipVertical size={10} /> Flip Y
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => onToggleCrop?.()}
                className={cn("flex-1 py-2 px-2 text-[10px] font-bold uppercase rounded border transition-all flex items-center justify-center gap-2", isCropping ? "bg-amber-600 border-amber-400 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10")}
              >
                <CropIcon size={12} /> {isCropping ? "Done Cropping" : "Crop Selected Clip"}
              </button>
            </div>
            <div className="space-y-2 mt-4">
              <label className="text-[10px] font-medium text-gray-400">Blend Mode</label>
              <select 
                value={selectedClip?.transform?.blendMode || "source-over"}
                onChange={(e) => updateTransform('blendMode', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-[10px] font-bold text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="source-over">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="darken">Darken</option>
                <option value="lighten">Lighten</option>
                <option value="color-dodge">Color Dodge</option>
                <option value="color-burn">Color Burn</option>
                <option value="hard-light">Hard Light</option>
                <option value="soft-light">Soft Light</option>
                <option value="difference">Difference</option>
                <option value="exclusion">Exclusion</option>
              </select>
            </div>
          </InspectorSection>

          <InspectorSection title="Keyframes / Animation" icon={<FastForward size={12} />}>
            <div className="flex justify-between items-center mb-4">
               <span className="text-[10px] text-gray-400 font-medium">Auto-capture transform at playhead</span>
               <button 
                 onClick={addKeyframe} 
                 className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[9px] font-bold uppercase text-white shadow"
               >
                 + Add Keyframe
               </button>
            </div>
            
            <div className="space-y-2">
               {selectedClip?.keyframes && selectedClip.keyframes.length > 0 ? (
                 [...selectedClip.keyframes].sort((a,b) => a.time - b.time).map((kf, i) => (
                   <div key={kf.id} className="p-2 bg-white/5 border border-white/10 rounded-md">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-bold text-gray-300">
                         @{kf.time.toFixed(2)}s {i === 0 ? "(Start)" : i === selectedClip.keyframes!.length - 1 ? "(End)" : ""}
                       </span>
                       <button onClick={() => removeKeyframe(kf.id)} className="text-red-400 hover:text-red-300">
                         <Scissor size={10} />
                       </button>
                     </div>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                       <div>
                         <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">X</label>
                         <input type="number" value={kf.properties.x ?? 0} onChange={(e) => updateKeyframe(kf.id, { properties: { ...kf.properties, x: parseFloat(e.target.value) } })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-0.5 px-1 rounded text-white" />
                       </div>
                       <div>
                         <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">Y</label>
                         <input type="number" value={kf.properties.y ?? 0} onChange={(e) => updateKeyframe(kf.id, { properties: { ...kf.properties, y: parseFloat(e.target.value) } })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-0.5 px-1 rounded text-white" />
                       </div>
                       <div>
                         <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">Scale</label>
                         <input type="number" value={kf.properties.scale ?? 1} onChange={(e) => updateKeyframe(kf.id, { properties: { ...kf.properties, scale: parseFloat(e.target.value) } })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-0.5 px-1 rounded text-white" />
                       </div>
                       <div>
                         <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">Opacity</label>
                         <input type="number" value={kf.properties.opacity ?? 1} onChange={(e) => updateKeyframe(kf.id, { properties: { ...kf.properties, opacity: parseFloat(e.target.value) } })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-0.5 px-1 rounded text-white" />
                       </div>
                       <div>
                         <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">Rotation</label>
                         <input type="number" value={kf.properties.rotation ?? 0} onChange={(e) => updateKeyframe(kf.id, { properties: { ...kf.properties, rotation: parseFloat(e.target.value) } })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-0.5 px-1 rounded text-white" />
                       </div>
                     </div>
                     <div>
                       <label className="text-[8px] uppercase text-gray-500 font-bold block mb-1">Easing (to next)</label>
                       <select value={kf.easing} onChange={(e) => updateKeyframe(kf.id, { easing: e.target.value })} className="w-full bg-[#1A1A1A] border-white/10 text-[10px] py-1 px-1 rounded text-white">
                         <option value="linear">Linear</option>
                         <option value="ease-in">Ease In</option>
                         <option value="ease-out">Ease Out</option>
                         <option value="ease-in-out">Ease In/Out</option>
                         <option value="bezier">Bezier</option>
                       </select>
                     </div>
                   </div>
                 ))
               ) : (
                 <p className="text-[10px] text-gray-500 text-center py-4">No keyframes yet.<br/>Use keyframes to animate transform properties over time.</p>
               )}
            </div>
          </InspectorSection>

          <InspectorSection title="Masking" icon={<Scissor size={12} />}>
            <div className="space-y-2">
              <label className="text-[10px] font-medium text-gray-400">Mask Shape</label>
              <select 
                value={selectedClip?.transform?.mask?.type || "none"}
                onChange={(e) => updateTransform('mask', { ...(selectedClip?.transform?.mask || {}), type: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-[10px] font-bold text-gray-300 focus:outline-none focus:border-blue-500"
              >
                <option value="none">None</option>
                <option value="circle">Circle</option>
                <option value="square">Square</option>
                <option value="star">Star</option>
                <option value="heart">Heart</option>
                <option value="triangle">Triangle</option>
                <option value="custom">Custom (SVG Path)</option>
              </select>
            </div>
            
            {selectedClip?.transform?.mask?.type === 'custom' && (
              <div className="space-y-2 mt-2">
                <label className="text-[10px] font-medium text-gray-400">SVG Path Data (d)</label>
                <textarea 
                  value={selectedClip?.transform?.mask?.path || ""}
                  onChange={(e) => updateTransform('mask', { ...(selectedClip?.transform?.mask || {}), path: e.target.value })}
                  placeholder="M10 10 H 90 V 90 H 10 L 10 10"
                  className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-[10px] text-gray-300 focus:outline-none focus:border-blue-500 h-16 resize-none"
                />
              </div>
            )}

            {selectedClip?.transform?.mask?.type && selectedClip?.transform?.mask?.type !== 'none' && (
              <div className="flex items-center justify-between mt-3 p-2 rounded bg-white/5 border border-white/5 mb-2">
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Invert Mask</label>
                <button 
                  onClick={() => updateTransform('mask', { ...(selectedClip?.transform?.mask || {}), invert: !selectedClip?.transform?.mask?.invert })}
                  className={cn(
                    "w-8 h-4 rounded-full transition-all relative",
                    selectedClip?.transform?.mask?.invert ? "bg-blue-500" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    selectedClip?.transform?.mask?.invert ? "left-4.5" : "left-0.5"
                  )} />
                </button>
              </div>
            )}
          </InspectorSection>

          <InspectorSection title="Drop Shadow" icon={<Monitor size={12} />}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-gray-400 font-medium">Color</label>
              <input 
                type="color" 
                value={selectedClip?.transform?.dropShadow?.color || '#000000'}
                onChange={(e) => updateTransform('dropShadow', { ...(selectedClip?.transform?.dropShadow || {x:0, y:0, blur:10, opacity:0.5}), color: e.target.value })}
                className="w-12 h-6 bg-transparent border-none p-0 cursor-pointer"
              />
            </div>
            <SliderProperty 
              label="Opacity" 
              value={selectedClip?.transform?.dropShadow?.opacity ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateTransform('dropShadow', { ...(selectedClip?.transform?.dropShadow || {x:0, y:0, blur:10, color:'#000000'}), opacity: v })} 
              title="Shadow opacity (0 to disable)"
            />
            {selectedClip?.transform?.dropShadow?.opacity ? (
              <>
                <SliderProperty 
                  label="Distance X" 
                  value={selectedClip?.transform?.dropShadow?.x ?? 0} 
                  min={-100} max={100} step={1}
                  onChange={(v) => updateTransform('dropShadow', { ...selectedClip.transform.dropShadow!, x: v })} 
                />
                <SliderProperty 
                  label="Distance Y" 
                  value={selectedClip?.transform?.dropShadow?.y ?? 0} 
                  min={-100} max={100} step={1}
                  onChange={(v) => updateTransform('dropShadow', { ...selectedClip.transform.dropShadow!, y: v })} 
                />
                <SliderProperty 
                  label="Blur" 
                  value={selectedClip?.transform?.dropShadow?.blur ?? 10} 
                  min={0} max={100} step={1}
                  onChange={(v) => updateTransform('dropShadow', { ...selectedClip.transform.dropShadow!, blur: v })} 
                />
              </>
            ) : null}
          </InspectorSection>

          <InspectorSection title="Playback" icon={<FastForward size={12} />}>
            <SliderProperty 
              label="Speed" 
              value={selectedClip?.speed ?? 1} 
              min={0.25} max={4} step={0.25}
              onChange={(v) => updateClipProp('speed', v)} 
              title="Multiplier for media playback speed (e.g. 2x is double speed)"
            />
          </InspectorSection>

          <InspectorSection title="Source Range" icon={<Scissor size={12} />}>
            <SliderProperty 
              label="Start Time (s)" 
              value={selectedClip?.sourceStart ?? 0} 
              min={0} max={selectedClip?.duration || 60} step={0.1}
              onChange={(v) => updateClipProp('sourceStart', v)} 
              title="Crop the beginning of the media file"
            />
            <SliderProperty 
              label="End Time (s)" 
              value={selectedClip?.sourceEnd ?? (selectedClip?.duration || 60)} 
              min={0} max={selectedClip?.duration || 60} step={0.1}
              onChange={(v) => updateClipProp('sourceEnd', v)} 
              title="Crop the end of the media file"
            />
          </InspectorSection>

          <div className="p-4 rounded-lg bg-white/5 border border-white/5" title="Technical data for the selected clip">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Clip & Asset Metadata</h4>
            <div className="space-y-1 mb-2">
              <p className="text-[10px] text-gray-400 truncate"><span className="text-gray-600">Name:</span> {selectedClip?.name}</p>
              <p className="text-[10px] text-gray-400"><span className="text-gray-600">Type:</span> {selectedClip?.type?.toUpperCase()}</p>
              {selectedAsset?.metadata?.codec && (
                <p className="text-[10px] text-gray-400"><span className="text-gray-600">Codec:</span> {selectedAsset.metadata.codec}</p>
              )}
              {selectedAsset?.metadata?.resolution && (
                <p className="text-[10px] text-gray-400"><span className="text-gray-600">Format:</span> {selectedAsset.metadata.resolution} @ {selectedAsset.metadata.fps}fps {selectedAsset.metadata.bitDepth}-bit</p>
              )}
            </div>
            
            {selectedAsset?.proxyStatus && (
               <div className="mt-3 pt-3 border-t border-white/5">
                 <div className="flex items-center justify-between mb-1">
                   <h5 className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Proxy File</h5>
                   <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase", selectedAsset.proxyStatus === 'ready' ? "bg-green-500/20 text-green-400" : selectedAsset.proxyStatus === 'generating' ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400")}>
                      {selectedAsset.proxyStatus}
                   </span>
                 </div>
                 {selectedAsset.proxyStatus === 'ready' && (
                   <SwitchProperty 
                     label="Use Proxy For Playback" 
                     checked={state.useProxies ?? true} 
                     onChange={(c) => setState(s => ({ ...s, useProxies: c }))} 
                   />
                 )}
               </div>
            )}
            
            {selectedAsset?.sourceSettings && (
               <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                 <h5 className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Source Settings (RAW/Log)</h5>
                 <div className="space-y-1">
                   <label className="text-[10px] font-medium text-gray-400">Color Space Override</label>
                   <select 
                     value={selectedAsset?.sourceSettings?.colorSpace || "auto"}
                     onChange={(e) => {
                       setState(s => ({
                         ...s,
                         assets: s.assets.map(a => a.id === selectedAsset.id ? { ...a, sourceSettings: { ...a.sourceSettings!, colorSpace: e.target.value as any } } : a)
                       }));
                     }}
                     className="w-full bg-[#1A1A1A] border border-white/10 rounded-md py-1 px-2 text-[10px] font-bold text-gray-300 focus:outline-none focus:border-blue-500"
                   >
                     <option value="auto">Auto-Detect</option>
                     <option value="rec709">Rec.709 (SDR)</option>
                     <option value="slog2">Sony S-Log2</option>
                     <option value="vlog">Panasonic V-Log</option>
                     <option value="clog">Canon C-Log</option>
                   </select>
                 </div>
               </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "color" && state.selectedClipId && (
        <ColorPanel clipId={state.selectedClipId} />
      )}

      {activeTab === "audio" && state.selectedClipId && (
        <EssentialSound state={state} setState={setState} />
      )}

      {(activeTab === "graphics" || activeTab === "captions") && state.selectedClipId && (
        <GraphicsProperties state={state} setState={setState} />
      )}

      {activeTab === "effects" && (
        <div className="space-y-6">
          <EffectControls state={state} setState={setState} />
          
          <InspectorSection title="Legacy Effects" icon={<Sparkles size={12} />}>
            <SliderProperty 
              label="Gaussian Blur (Legacy)" 
              value={selectedClip?.filters?.blur ?? 0} 
              min={0} max={20} step={0.5}
              onChange={(v) => updateFilter('blur', v)} 
              title="Soften the image to simulate an out-of-focus effect"
            />
            <SliderProperty 
              label="Vignette Strength" 
              value={selectedClip?.filters?.vignette ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateFilter('vignette', v)} 
              title="Darken the edges of the frame to draw focus to the center"
            />
            <SliderProperty 
              label="Film Grain (Legacy)" 
              value={selectedClip?.filters?.grain ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateFilter('grain', v)} 
              title="Add simulated noisy film grain texture"
            />
          </InspectorSection>

          <InspectorSection title="Cutout & Chroma" icon={<Scissor size={12} />}>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5 mb-4">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Enable Cutout</label>
              <button 
                onClick={() => updateCutout('enabled', !(selectedClip?.cutout?.enabled ?? false))}
                className={cn(
                  "w-8 h-4 rounded-full transition-all relative",
                  selectedClip?.cutout?.enabled ? "bg-blue-500" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                  selectedClip?.cutout?.enabled ? "left-4.5" : "left-0.5"
                )} />
              </button>
            </div>

            {selectedClip?.cutout?.enabled && (
              <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateCutout('type', 'chroma')}
                    className={cn("flex-1 py-1 px-2 text-[8px] font-bold uppercase rounded border transition-all", selectedClip.cutout.type === 'chroma' ? "bg-blue-600 border-blue-400" : "bg-white/5 border-white/5 text-gray-500")}
                  >
                    Chroma Key
                  </button>
                  <button 
                    onClick={() => updateCutout('type', 'ai')}
                    className={cn("flex-1 py-1 px-2 text-[8px] font-bold uppercase rounded border transition-all", selectedClip.cutout.type === 'ai' ? "bg-blue-600 border-blue-400" : "bg-white/5 border-white/5 text-gray-500")}
                  >
                    AI Cutout
                  </button>
                </div>

                {selectedClip.cutout.type === 'chroma' && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-400 font-medium">Key Color</label>
                      <input 
                        type="color" 
                        value={selectedClip.cutout.keyColor || '#00ff00'}
                        onChange={(e) => updateCutout('keyColor', e.target.value)}
                        className="w-12 h-6 bg-transparent border-none p-0 cursor-pointer"
                      />
                    </div>
                    <SliderProperty 
                      label="Similarity" 
                      value={selectedClip.cutout.similarity ?? 0.1} 
                      min={0} max={1} step={0.01}
                      onChange={(v) => updateCutout('similarity', v)} 
                    />
                  </>
                )}

                {selectedClip.cutout.type === 'ai' && (
                  <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                     <p className="text-[9px] text-blue-400 font-bold uppercase mb-1">AI Semantic Segmentation</p>
                     <p className="text-[8px] text-blue-300 leading-tight">Advanced subject isolation using neural networks. Optimized for portrait and center-stage subjects.</p>
                  </div>
                )}
              </div>
            )}
          </InspectorSection>
          
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-2">Pro Tip</h4>
            <p className="text-[10px] text-gray-500 leading-relaxed italic">
              "Blur effects can significantly increase APNG file size. Use sparingly for optimization."
            </p>
          </div>
        </div>
      )}

      {activeTab === "audio" && (
        <div className="space-y-6">
          <InspectorSection title="Mixer" icon={<Volume2 size={12} />}>
            <div className="flex items-center justify-between mb-2 p-2 rounded bg-white/5 border border-white/5">
              <label className="text-[10px] font-medium text-gray-400">Mute Audio</label>
              <button 
                onClick={() => updateAudio('muted', !(selectedClip?.audio?.muted ?? false))}
                className={cn(
                  "w-8 h-4 rounded-full transition-all relative",
                  selectedClip?.audio?.muted ? "bg-red-500" : "bg-white/10"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                  selectedClip?.audio?.muted ? "left-4.5" : "left-0.5"
                )} />
              </button>
            </div>
            <SliderProperty 
              label="Volume" 
              value={selectedClip?.audio?.volume ?? 1} 
              min={0} max={2} step={0.01}
              onChange={(v) => updateAudio('volume', v)} 
              title="Master volume multiplier for this specific clip"
            />
            <SliderProperty 
              label="Panning" 
              value={selectedClip?.audio?.pan ?? 0} 
              min={-1} max={1} step={0.01}
              onChange={(v) => updateAudio('pan', v)} 
              title="Stereo placement (Left to Right)"
            />
          </InspectorSection>

          <InspectorSection title="Equalizer" icon={<Sliders size={12} />}>
            <SliderProperty 
              label="Bass" 
              value={selectedClip?.audio?.eq?.low ?? 0} 
              min={-20} max={20} step={1}
              onChange={(v) => updateAudio('eq', v, 'low')} 
            />
            <SliderProperty 
              label="Mid" 
              value={selectedClip?.audio?.eq?.mid ?? 0} 
              min={-20} max={20} step={1}
              onChange={(v) => updateAudio('eq', v, 'mid')} 
            />
            <SliderProperty 
              label="Treble" 
              value={selectedClip?.audio?.eq?.high ?? 0} 
              min={-20} max={20} step={1}
              onChange={(v) => updateAudio('eq', v, 'high')} 
            />
          </InspectorSection>
          
          <InspectorSection title="Effects" icon={<Sparkles size={12} />}>
            <SliderProperty 
              label="Reverb" 
              value={selectedClip?.audio?.effects?.reverb ?? 0} 
              min={0} max={1} step={0.05}
              onChange={(v) => updateAudio('effects', v, 'reverb')} 
            />
            <SliderProperty 
              label="Delay" 
              value={selectedClip?.audio?.effects?.delay ?? 0} 
              min={0} max={1} step={0.05}
              onChange={(v) => updateAudio('effects', v, 'delay')} 
            />
          </InspectorSection>

          <InspectorSection title="Fade Transitions" icon={<MoveHorizontal size={12} />}>
            <SliderProperty 
              label="Fade In (s)" 
              value={selectedClip?.audio?.fadeIn ?? 0} 
              min={0} max={5} step={0.1}
              onChange={(v) => updateAudio('fadeIn', v)} 
              title="Seconds taken to fade audio in from silence at the start"
            />
            <SliderProperty 
              label="Fade Out (s)" 
              value={selectedClip?.audio?.fadeOut ?? 0} 
              min={0} max={5} step={0.1}
              onChange={(v) => updateAudio('fadeOut', v)} 
              title="Seconds taken to fade audio out to silence at the end"
            />
          </InspectorSection>

          <InspectorSection title="AI Intelligence" icon={<Zap size={12} />}>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleAIAction('Enhance Voice')}
                className="flex flex-col items-center gap-2 p-2 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-blue-400"
              >
                <Sparkles size={16} />
                <span className="text-[8px] font-bold uppercase tracking-tighter">Enhance</span>
              </button>
              <button 
                onClick={() => handleAIAction('Noise Removal')}
                className={cn(
                  "flex flex-col items-center gap-2 p-2 rounded transition-all",
                  selectedClip?.audio?.aiNoiseReduction 
                    ? "bg-purple-600/30 border border-purple-500/50 text-purple-300"
                    : "bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 text-purple-400"
                )}
              >
                {isProcessingAI === 'Noise Removal' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wind size={16} />
                )}
                <span className="text-[8px] font-bold uppercase tracking-tighter">De-Noise</span>
              </button>
              <button 
                onClick={() => handleAIAction('Generate Captions')}
                className="flex flex-col items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-emerald-400"
              >
                <Monitor size={16} />
                <span className="text-[8px] font-bold uppercase tracking-tighter">Captions</span>
              </button>
              <button 
                onClick={() => handleAIAction('Voice To Text')}
                className="flex flex-col items-center gap-2 p-2 rounded bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-all text-orange-400"
              >
                <Info size={16} />
                <span className="text-[8px] font-bold uppercase tracking-tighter">STT</span>
              </button>
              <button 
                onClick={() => handleAIAction('Remove Sound')}
                className="col-span-2 flex items-center justify-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-400"
              >
                <Volume2 size={14} className="opacity-50" />
                <span className="text-[8px] font-bold uppercase tracking-tighter">Strip Audio Track</span>
              </button>
            </div>
          </InspectorSection>
        </div>
      )}
    </div>
  );
}

export function InspectorSection({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded bg-white/5 text-gray-500">
          {icon}
        </div>
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">{title}</h4>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

