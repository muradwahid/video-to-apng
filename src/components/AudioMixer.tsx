import React, { useEffect, useState, useRef } from 'react';
import { TimelineState } from '../types';
import { audioEngine, AudioLevels } from '../services/audioEngine';
import { Volume2, VolumeX, Mic2, FileAudio, SlidersHorizontal, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { clamp } from '../lib/utils';

interface TrackStripProps {
  label: string;
  trackIndex: number; // or -1 for master
  analyser: AnalyserNode;
  volume: number;
  pan: number;
  muted: boolean;
  onVolumeChange: (vol: number) => void;
  onPanChange: (pan: number) => void;
  onMuteToggle: () => void;
}

const dbToLinear = (db: number) => Math.pow(10, db / 20);
const linearToDb = (linear: number) => linear <= 0 ? -100 : 20 * Math.log10(linear);

const TrackStrip: React.FC<TrackStripProps> = ({ label, trackIndex, analyser, volume, pan, muted, onVolumeChange, onPanChange, onMuteToggle }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    let afId: number;
    const ctx = canvasRef.current?.getContext('2d');
    
    const draw = () => {
       if (ctx && analyser) {
          const levels = audioEngine.getLevels(analyser);
          
          // Draw Peak meter
          ctx.clearRect(0, 0, 20, 150);
          
          // Background
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, 20, 150);
          
          const drawMeter = (val: number, x: number) => {
             const h = clamp((val) * 150, 0, 150); // very basic mapping
             // gradient
             const grad = ctx.createLinearGradient(0, 150, 0, 0);
             grad.addColorStop(0, '#10b981'); // Emerald
             grad.addColorStop(0.7, '#f59e0b'); // Amber
             grad.addColorStop(1, '#ef4444'); // Red
             
             ctx.fillStyle = grad;
             ctx.fillRect(x, 150 - h, 8, h);
          }
          
          drawMeter(levels.peakL, 1);
          drawMeter(levels.peakR, 11);
       }
       afId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(afId);
  }, [analyser]);

  return (
    <div className="flex flex-col items-center bg-black/40 border border-white/5 rounded-lg p-3 w-20 shrink-0 gap-4">
      {/* Pan Knob */}
      <div className="flex flex-col items-center gap-1 group relative">
        <label className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{Math.round(pan * 100)}</label>
        <div 
          className="w-8 h-8 rounded-full border border-white/20 bg-white/5 relative cursor-ns-resize flex items-center justify-center"
          onPointerDown={(e) => {
            const startY = e.clientY;
            const startPan = pan;
            const move = (e: PointerEvent) => {
               const delta = (startY - e.clientY) / 50;
               onPanChange(clamp(startPan + delta, -1, 1));
            }
            const up = () => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
            }
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          }}
        >
           <div className="w-1 h-3 bg-white rounded-full absolute top-1" style={{ transform: `rotate(${pan * 90}deg)`, transformOrigin: '50% 100%' }} />
        </div>
      </div>
      
      {/* Fader & Meter */}
      <div className="flex gap-2 h-40">
        <div className="relative w-8 h-full bg-black/50 border border-white/10 rounded-full flex justify-center">
           <input 
              type="range"
              min="-60" max="6" step="0.1"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-2 appearance-none bg-transparent cursor-pointer"
              style={{ transform: 'translate(-50%, -50%) rotate(-90deg)' }}
           />
           <div className="absolute bottom-0 w-4 h-6 bg-gray-500 rounded border box-border border-white/20 pointer-events-none shadow-lg" style={{ bottom: `${Math.max(0, Math.min(100, (volume + 60) / 66 * 100)) - 5}%` }}>
              <div className="w-full h-[1px] bg-white/50 mt-2.5"></div>
           </div>
        </div>
        <canvas ref={canvasRef} width={20} height={150} className="w-5 h-full rounded border border-white/5 bg-black/40" />
      </div>

      {/* Buttons */}
      <div className="flex gap-1 w-full justify-center">
         <button onClick={onMuteToggle} className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors", muted ? "bg-red-500 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20")}>M</button>
         <button className={cn("w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-colors bg-white/10 text-gray-400 hover:bg-white/20")}>S</button>
      </div>

      {/* Label */}
      <div className="w-full text-center truncate px-1 mt-auto">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
      </div>
    </div>
  )
}

export function AudioMixer({ state, setState }: { state: TimelineState, setState: React.Dispatch<React.SetStateAction<TimelineState>> }) {
  // We need to keep tracks' volume and pan in TimelineState, since they are global settings per track.
  // We didn't add track config to TimelineState yet, let's just use state.clips for clip audio, 
  // but for tracks we ideally want state.tracks[i] or keep it local for now.
  
  const [trackStates, setTrackStates] = useState(Array(4).fill({ volume: 0, pan: 0, muted: false }));
  
  const updateTrack = (index: number, updates: any) => {
     setTrackStates(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
     });
     
     if (updates.volume !== undefined) {
         audioEngine.setTrackVolume(index, updates.volume);
     }
     if (updates.pan !== undefined) {
         audioEngine.setTrackPan(index, updates.pan);
     }
     if (updates.muted !== undefined) {
         // for track mute, we might need a separate method in AudioEngine or set volume to -100
         audioEngine.setTrackVolume(index, updates.muted ? -100 : trackStates[index].volume);
     }
  };

  return (
    <div className="flex h-full p-4 overflow-x-auto custom-scrollbar gap-2">
       {[0, 1, 2, 3].map(i => (
          <TrackStrip 
            key={i} 
            label={`A${i+1}`}
            trackIndex={i}
            analyser={audioEngine.trackAnalysers[i]}
            volume={trackStates[i].volume}
            pan={trackStates[i].pan}
            muted={trackStates[i].muted}
            onVolumeChange={(v) => updateTrack(i, { volume: v })}
            onPanChange={(p) => updateTrack(i, { pan: p })}
            onMuteToggle={() => updateTrack(i, { muted: !trackStates[i].muted })}
          />
       ))}

       <div className="w-4 flex shrink-0 justify-center">
         <div className="w-px h-full bg-white/10 mx-auto" />
       </div>

       <TrackStrip 
          label="MASTER"
          trackIndex={-1}
          analyser={audioEngine.masterAnalyser}
          volume={linearToDb(state.masterVolume ?? 1)}
          pan={0} // Master pan not implemented yet, default 0
          muted={!!state.globalAudioMute}
          onVolumeChange={(v) => setState(s => ({ ...s, masterVolume: dbToLinear(v) }))}
          onPanChange={() => {}}
          onMuteToggle={() => setState(s => ({ ...s, globalAudioMute: !s.globalAudioMute }))}
        />
    </div>
  )
}
