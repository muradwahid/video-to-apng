import React, { useState } from "react";
import { ImageIcon, Command, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { APNGOptions } from "@/src/types";

interface Props {
  onConvert: (options: APNGOptions) => Promise<void>;
  isProcessing: boolean;
  progress: number;
}

export const APNGConverter: React.FC<Props> = ({ onConvert, isProcessing, progress }) => {
  const [options, setOptions] = useState<APNGOptions & { loopCount: number, scale: number }>({
    fps: 24,
    quality: 85,
    compression: 6,
    dithering: true,
    loopCount: 0, // 0 for infinite
    scale: 0.5, // 50% scale
    loopDelay: 0
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <SettingTile 
          label="Target FPS" 
          value={options.fps} 
          displayValue={options.fps}
          min={1} max={60} 
          onChange={(v) => setOptions({ ...options, fps: v })} 
        />
        <SettingTile 
          label="Loop Count" 
          value={options.loopCount} 
          displayValue={options.loopCount === 0 ? "Infinite" : options.loopCount}
          min={0} max={10} 
          onChange={(v) => setOptions({ ...options, loopCount: v })} 
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SettingTile 
          label="Gap Time (s)" 
          value={options.loopDelay} 
          displayValue={options.loopDelay + "s"}
          min={0} max={5}
          onChange={(v) => setOptions({ ...options, loopDelay: v })} 
        />
        <SettingTile 
          label="Quality" 
          displayValue={options.quality + "%"} 
          value={options.quality}
          min={10} max={100} 
          onChange={(v) => setOptions({ ...options, quality: v })} 
        />
      </div>

      <SettingTile 
        label="Scale" 
        displayValue={Math.round(options.scale * 100) + "%"} 
        value={options.scale * 100}
        min={10} max={100} 
        onChange={(v) => setOptions({ ...options, scale: v / 100 })} 
      />

      <div className="space-y-4 rounded-lg bg-black p-4 border border-white/5">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Advanced Engine</h4>
        
        <div className="flex items-center justify-between group cursor-pointer">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-gray-300">Dithering Algorithm</span>
            <p className="text-[9px] text-gray-600">Floyd-Steinberg Spatial</p>
          </div>
          <Toggle active={options.dithering} onClick={() => setOptions({ ...options, dithering: !options.dithering })} />
        </div>
      </div>

      {isProcessing ? (
        <div className="space-y-4 pt-4 border-t border-white/5">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
              Processing...
            </span>
            <span className="font-mono text-orange-500">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              className="h-full bg-orange-600 shadow-[0_0_12px_rgba(234,88,12,0.4)]"
            />
          </div>
        </div>
      ) : (
        <button 
          onClick={() => onConvert(options)}
          className="w-full py-4 bg-orange-600/10 text-orange-400 border border-orange-600/30 rounded-lg text-[11px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-orange-600/20 active:scale-95"
        >
          Generate APNG
        </button>
      )}

      <div className="flex items-start gap-3 rounded-lg bg-orange-950/10 p-3 border border-orange-900/20">
        <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-orange-400/60 font-medium italic">
          Palette optimization is synced with target color depth. 
          Expected size: ~4.2MB
        </p>
      </div>
    </div>
  );
};

function SettingTile({ label, value, displayValue, min, max, onChange }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
        <span className="font-mono text-[10px] text-orange-500 font-bold">{displayValue || value}</span>
      </div>
      <input 
        type="range" min={min} max={max} value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 accent-orange-600 bg-gray-900 rounded-full cursor-pointer"
      />
    </div>
  );
}

function Toggle({ active, onClick }: any) {
  return (
    <div onClick={onClick} className={cn("h-4 w-8 rounded-full transition-colors relative cursor-pointer", active ? "bg-orange-600" : "bg-gray-800")}>
      <motion.div 
        animate={{ x: active ? 18 : 2 }}
        className="absolute top-1 h-2 w-2 rounded-full bg-white shadow-sm"
      />
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
