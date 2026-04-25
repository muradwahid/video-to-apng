import React from 'react';
import { TimelineState, VideoClip } from '../types';
import { audioEngine } from '../services/audioEngine';
import { 
  Sun, Contrast, Droplets, Sparkles, Wind, Volume2, 
  MoveHorizontal, Maximize2, RotateCw, FastForward, 
  Scissors as Scissor, Sliders, Zap, Monitor, Info 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface PropertyInspectorProps {
  state: TimelineState;
  setState: React.Dispatch<React.SetStateAction<TimelineState>>;
  activeTab: "media" | "effects" | "color" | "audio" | "export";
}

function SliderProperty({ label, value, min, max, step, onChange, title }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, title?: string }) {
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

export function PropertyInspector({ state, setState, activeTab }: PropertyInspectorProps) {
  const selectedClip = state.clips.find(c => c.id === state.selectedClipId);

  const updateTransform = (key: string, value: number) => {
    if (!state.selectedClipId) return;
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === prev.selectedClipId ? {
        ...c,
        transform: {
          ...(c.transform || {}),
          [key]: value
        }
      } : c)
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
          brightness: 1, contrast: 1, saturation: 1, blur: 0, grayscale: 0, sepia: 0, invert: 0,
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

  const handleAIAction = async (action: string) => {
    if (!state.selectedClipId) return;
    alert(`Triggering AI ${action} for selected clip. This would use Gemini API for processing.`);
    // Implementation would go here calling Gemini API with audio data
  };

  if (!selectedClip && activeTab !== "export") {
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
          <InspectorSection title="Transform" icon={<Maximize2 size={12} />}>
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
            <h4 className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Clip Info</h4>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 truncate"><span className="text-gray-600">Name:</span> {selectedClip?.name}</p>
              <p className="text-[10px] text-gray-400"><span className="text-gray-600">Type:</span> {selectedClip?.type?.toUpperCase()}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "color" && (
        <div className="space-y-6">
          <InspectorSection title="Color Correction" icon={<Sun size={12} />}>
            <SliderProperty 
              label="Brightness" 
              value={selectedClip?.filters?.brightness ?? 1} 
              min={0} max={2} step={0.01}
              onChange={(v) => updateFilter('brightness', v)} 
              title="Adjust the overall light level (1 is default)"
            />
            <SliderProperty 
              label="Contrast" 
              value={selectedClip?.filters?.contrast ?? 1} 
              min={0} max={2} step={0.01}
              onChange={(v) => updateFilter('contrast', v)} 
              title="Adjust the difference between light and dark areas"
            />
            <SliderProperty 
              label="Saturation" 
              value={selectedClip?.filters?.saturation ?? 1} 
              min={0} max={2} step={0.01}
              onChange={(v) => updateFilter('saturation', v)} 
              title="Adjust the intensity of colors"
            />
          </InspectorSection>
          
          <InspectorSection title="Filters" icon={<Droplets size={12} />}>
            <SliderProperty 
              label="Grayscale" 
              value={selectedClip?.filters?.grayscale ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateFilter('grayscale', v)} 
              title="Convert colors progressively to black and white"
            />
            <SliderProperty 
              label="Sepia" 
              value={selectedClip?.filters?.sepia ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateFilter('sepia', v)} 
              title="Apply a vintage yellowish-brown tint"
            />
            <SliderProperty 
              label="Invert" 
              value={selectedClip?.filters?.invert ?? 0} 
              min={0} max={1} step={0.01}
              onChange={(v) => updateFilter('invert', v)} 
              title="Invert all colors in the media"
            />
          </InspectorSection>
        </div>
      )}

      {activeTab === "effects" && (
        <div className="space-y-6">
          <InspectorSection title="Visual Effects" icon={<Sparkles size={12} />}>
            <SliderProperty 
              label="Gaussian Blur" 
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
              label="Film Grain" 
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
                className="flex flex-col items-center gap-2 p-2 rounded bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all text-purple-400"
              >
                <Wind size={16} />
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

function InspectorSection({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
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

