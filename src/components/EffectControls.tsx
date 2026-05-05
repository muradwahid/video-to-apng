import React from 'react';
import { TimelineState, VideoClip, EffectNode } from '../types';
import { EFFECT_DEFS } from '../lib/effectsDefs';
import { Settings2, Trash2, Power } from 'lucide-react';

interface EffectControlsProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
}

export function EffectControls({ state, setState }: EffectControlsProps) {
  const selectedClip = (state.clips || []).find(c => c.id === state.selectedClipId);
  const effects = selectedClip?.effects || [];

  const updateEffect = (effectId: string, updates: Partial<EffectNode>) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
         if (c.id === selectedClip?.id) {
            return {
              ...c,
              effects: c.effects?.map(e => e.id === effectId ? { ...e, ...updates } : e)
            }
         }
         return c;
      })
    }));
  };

  const removeEffect = (effectId: string) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
         if (c.id === selectedClip?.id) {
            return {
              ...c,
              effects: c.effects?.filter(e => e.id !== effectId)
            }
         }
         return c;
      })
    }));
  };

  const updateEffectParam = (effectId: string, paramKey: string, val: any) => {
     setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
         if (c.id === selectedClip?.id) {
            return {
              ...c,
              effects: c.effects?.map(e => {
                  if (e.id === effectId) {
                      return {
                          ...e,
                          params: { ...e.params, [paramKey]: val }
                      }
                  }
                  return e;
              })
            }
         }
         return c;
      })
    }));
  }

  if (!selectedClip || effects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-50 px-4 text-center">
        <Settings2 size={24} className="mb-2" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">No Effects Applied</p>
        <p className="text-[9px] text-gray-500 mt-1">Drag effects from the FX library panel to this clip to apply them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {effects.map((effect, idx) => {
        const def = EFFECT_DEFS.find(d => d.id === effect.type);
        if (!def) return null;

        return (
          <div key={effect.id} className="bg-white/5 border border-white/5 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-black/40 border-b border-white/5">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateEffect(effect.id, { enabled: !effect.enabled })}
                  className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${effect.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-gray-500'}`}
                >
                  <Power size={10} />
                </button>
                <span className="text-[10px] font-bold tracking-widest uppercase text-white truncate max-w-[120px]" title={def.name}>{def.name}</span>
              </div>
              <button 
                  onClick={() => removeEffect(effect.id)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={10} />
              </button>
            </div>
            
            <div className={`p-3 space-y-3 ${!effect.enabled ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
              {def.controls.map(control => {
                 const val = effect.params[control.key] !== undefined ? effect.params[control.key] : def.defaultParams[control.key];
                 if (control.type === 'slider') {
                    return (
                      <div key={control.key} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{control.label}</label>
                          <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1 rounded">{typeof val === 'number' ? val.toFixed(2) : val}</span>
                        </div>
                        <input 
                          type="range" 
                          min={control.min} max={control.max} step={control.step}
                          value={val}
                          onChange={(e) => updateEffectParam(effect.id, control.key, parseFloat(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-full appearance-none accent-blue-500 cursor-pointer"
                        />
                      </div>
                    )
                 }
                 // Add color picker etc. later
                 return null;
              })}
            </div>
          </div>
        )
      })}
    </div>
  );
}
