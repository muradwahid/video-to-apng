import React from 'react';
import { TimelineState, VideoClip } from '../types';
import { InspectorSection, SwitchProperty, SliderProperty } from './PropertyInspector';
import { Mic2, Music, Waves, Wind } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface EssentialSoundProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
}

function PropertyGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</h3>
      {children}
    </div>
  );
}

export function EssentialSound({ state, setState }: EssentialSoundProps) {
  const selectedClip = (state.clips || []).find(c => c.id === state.selectedClipId);

  if (!selectedClip || !['video', 'audio'].includes(selectedClip.type)) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-50 px-4 text-center text-gray-400">
         <Waves size={24} className="mb-2" />
         <span className="text-[10px] font-bold uppercase tracking-widest">Select Audio Clip</span>
      </div>
    );
  }

  const audioConfig = selectedClip.audio || { volume: 1, fadeIn: 0, fadeOut: 0, muted: false };

  const updateAudio = (updates: any) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
         if (c.id === selectedClip.id) {
           const newClip = { ...c, audio: { ...(c.audio || { volume: 1, fadeIn: 0, fadeOut: 0, muted: false }), ...updates } };
           // push to audio engine immediately if playing
           if (state.isPlaying) {
             // to apply immediately wait for state update isn't needed if we directly call engine, but let's call it via useEffect in main component or here
             setTimeout(() => audioEngine.updateClipAudio(newClip), 10); 
           }
           return newClip;
         }
         return c;
      })
    }));
  };

  const setCategory = (cat: 'dialogue' | 'music' | 'sfx' | 'ambience' | undefined) => {
    updateAudio({ category: cat });
  };

  return (
    <div className="space-y-6">
      {/* Category Selection */}
      <div className="grid grid-cols-2 gap-2">
         {[
           { id: 'dialogue', label: 'Dialogue', icon: Mic2 },
           { id: 'music', label: 'Music', icon: Music },
           { id: 'sfx', label: 'SFX', icon: Waves },
           { id: 'ambience', label: 'Ambience', icon: Wind }
         ].map(cat => (
            <button
               key={cat.id}
               onClick={() => setCategory(audioConfig.category === cat.id ? undefined : cat.id as any)}
               className={`flex flex-col items-center justify-center p-3 rounded-lg border ${audioConfig.category === cat.id ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/40 border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
            >
               <cat.icon size={16} className="mb-1" />
               <span className="text-[9px] uppercase tracking-widest font-bold">{cat.label}</span>
            </button>
         ))}
      </div>

      <PropertyGroup title="Clip Volume">
         <SliderProperty 
           label="Gain" 
           value={audioConfig.volume} 
           min={0} max={2} step={0.05}
           onChange={(v) => updateAudio({ volume: v })}
         />
         <SliderProperty 
           label="Pan" 
           value={audioConfig.pan || 0} 
           min={-1} max={1} step={0.01}
           onChange={(v) => updateAudio({ pan: v })}
         />
      </PropertyGroup>

      {audioConfig.category === 'dialogue' && (
         <div className="space-y-4">
            <PropertyGroup title="Repair">
               <SwitchProperty
                  label="DeNoise"
                  checked={audioConfig.denoise?.enabled || false}
                  onChange={(c) => updateAudio({ denoise: { ...audioConfig.denoise, enabled: c, amount: audioConfig.denoise?.amount || 0.5 } })}
               />
               {audioConfig.denoise?.enabled && (
                 <SliderProperty 
                   label="Amount" value={audioConfig.denoise?.amount || 0.5} min={0} max={1} step={0.05}
                   onChange={(v) => updateAudio({ denoise: { ...audioConfig.denoise, amount: v, enabled: true } })}
                 />
               )}
            </PropertyGroup>
            <PropertyGroup title="Clarity">
               <SwitchProperty
                  label="Dynamics (Compressor)"
                  checked={audioConfig.compressor?.enabled || false}
                  onChange={(c) => updateAudio({ compressor: { ...audioConfig.compressor, enabled: c, threshold: -20, ratio: 3, attack: 0.05, release: 0.25, knee: 10, makeupGain: 2 } })}
               />
               <SwitchProperty
                  label="Limiter"
                  checked={audioConfig.limiter?.enabled || false}
                  onChange={(c) => updateAudio({ limiter: { ...audioConfig.limiter, enabled: c, ceiling: -1 } })}
               />
               <SwitchProperty
                  label="EQ: Vocal Enhance"
                  checked={audioConfig.eq?.high === 3} // mock
                  onChange={(c) => updateAudio({ eq: c ? { low: -2, mid: 1, high: 3 } : { low: 0, mid: 0, high: 0 } })}
               />
            </PropertyGroup>
         </div>
      )}

      {audioConfig.category === 'music' && (
         <div className="space-y-4">
            <PropertyGroup title="Dynamics">
               <SwitchProperty
                  label="Auto Ducking"
                  checked={false} // mock ducking
                  onChange={() => {}}
                  tooltip="Automatically lower volume when Dialogue clips are present"
               />
            </PropertyGroup>
         </div>
      )}

       {audioConfig.category === 'sfx' && (
         <div className="space-y-4">
            <PropertyGroup title="Effects">
               <SliderProperty 
                 label="Reverb Send" value={audioConfig.effects?.reverb || 0} min={0} max={1} step={0.05}
                 onChange={(v) => updateAudio({ effects: { ...audioConfig.effects, reverb: v } })}
               />
               <SliderProperty 
                 label="Delay" value={audioConfig.effects?.delay || 0} min={0} max={1} step={0.05}
                 onChange={(v) => updateAudio({ effects: { ...audioConfig.effects, delay: v } })}
               />
            </PropertyGroup>
         </div>
      )}

      {audioConfig.category === 'ambience' && (
         <div className="space-y-4">
            <PropertyGroup title="Creative">
               <SliderProperty 
                 label="Stereo Width" value={audioConfig.effects?.stereoWidth || 0} min={-1} max={1} step={0.05}
                 onChange={(v) => updateAudio({ effects: { ...audioConfig.effects, stereoWidth: v } })}
               />
            </PropertyGroup>
         </div>
      )}
      
      {!audioConfig.category && (
        <div className="opacity-50 px-2 py-4 text-center">
            <span className="text-[10px] text-gray-400">Assign an audio type to view essential sound controls.</span>
        </div>
      )}
    </div>
  );
}
