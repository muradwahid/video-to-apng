import React, { useState, useRef, useEffect, useCallback } from "react";
import { Move } from "lucide-react";

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  onCropChange: (crop: Crop) => void;
  onApply: (crop: Crop) => void;
  onCancel: () => void;
  initialCrop?: Crop;
}

export const CropTool: React.FC<Props> = ({ onCropChange, onApply, onCancel, initialCrop }) => {
  const [crop, setCrop] = useState<Crop>(initialCrop || { x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const resizeType = useRef<string | null>(null);
  const startPos = useRef({ x: 0, y: 0, crop });

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    isDragging.current = true;
    resizeType.current = type;
    startPos.current = { x: e.clientX, y: e.clientY, crop: { ...crop } };
    document.body.style.cursor = getCursor(type);
  };

  const getCursor = (type: string) => {
    switch (type) {
      case 'move': return 'move';
      case 'nw': return 'nwse-resize';
      case 'ne': return 'nesw-resize';
      case 'sw': return 'nesw-resize';
      case 'se': return 'nwse-resize';
      case 'n': return 'ns-resize';
      case 's': return 'ns-resize';
      case 'e': return 'ew-resize';
      case 'w': return 'ew-resize';
      default: return 'default';
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - startPos.current.x) / rect.width;
    const dy = (e.clientY - startPos.current.y) / rect.height;

    let newCrop = { ...startPos.current.crop };

    if (resizeType.current === 'move') {
      newCrop.x = Math.max(0, Math.min(1 - newCrop.width, startPos.current.crop.x + dx));
      newCrop.y = Math.max(0, Math.min(1 - newCrop.height, startPos.current.crop.y + dy));
    } else {
      const type = resizeType.current;
      if (type?.includes('w')) {
        const maxWidth = startPos.current.crop.x + startPos.current.crop.width;
        newCrop.x = Math.max(0, Math.min(maxWidth - 0.05, startPos.current.crop.x + dx));
        newCrop.width = maxWidth - newCrop.x;
      }
      if (type?.includes('e')) {
        newCrop.width = Math.max(0.05, Math.min(1 - startPos.current.crop.x, startPos.current.crop.width + dx));
      }
      if (type?.includes('n')) {
        const maxHeight = startPos.current.crop.y + startPos.current.crop.height;
        newCrop.y = Math.max(0, Math.min(maxHeight - 0.05, startPos.current.crop.y + dy));
        newCrop.height = maxHeight - newCrop.y;
      }
      if (type?.includes('s')) {
        newCrop.height = Math.max(0.05, Math.min(1 - startPos.current.crop.y, startPos.current.crop.height + dy));
      }
    }

    setCrop(newCrop);
    onCropChange(newCrop);
  }, [onCropChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    resizeType.current = null;
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="absolute inset-0 z-40 bg-black/40 overflow-hidden">
      <div 
        className="absolute border-2 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)] bg-blue-500/5 group"
        style={{
          left: `${crop.x * 100}%`,
          top: `${crop.y * 100}%`,
          width: `${crop.width * 100}%`,
          height: `${crop.height * 100}%`,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Handles */}
        <Handle position="absolute -top-1.5 -left-1.5 cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
        <Handle position="absolute -top-1.5 -right-1.5 cursor-nesw-resize" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
        <Handle position="absolute -bottom-1.5 -left-1.5 cursor-nesw-resize" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
        <Handle position="absolute -bottom-1.5 -right-1.5 cursor-nwse-resize" onMouseDown={(e) => handleMouseDown(e, 'se')} />
        
        <Handle position="absolute top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize h-4 w-1.5" onMouseDown={(e) => handleMouseDown(e, 'w')} />
        <Handle position="absolute top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize h-4 w-1.5" onMouseDown={(e) => handleMouseDown(e, 'e')} />
        <Handle position="absolute -top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize w-4 h-1.5" onMouseDown={(e) => handleMouseDown(e, 'n')} />
        <Handle position="absolute -bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize w-4 h-1.5" onMouseDown={(e) => handleMouseDown(e, 's')} />
        
        {/* Rule of Thirds */}
        <div className="h-full w-full grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20 border border-white/10">
          <div className="border border-white/5" /><div className="border border-white/5" /><div className="border border-white/5" />
          <div className="border border-white/5" /><div className="border border-white/5" /><div className="border border-white/5" />
          <div className="border border-white/5" /><div className="border border-white/5" /><div className="border border-white/5" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity">
          <Move className="h-4 w-4 text-white" />
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/90 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
        <div className="flex gap-4 border-r border-white/10 pr-6 mr-2">
          <PresetButton title="Snap to landscape aspect ratio" label="16:9" onClick={() => {
            const h = crop.width * (9/16);
            setCrop({ ...crop, height: Math.min(h, 1 - crop.y) });
          }} />
          <PresetButton title="Snap to portrait (TikTok/Reels) aspect ratio" label="9:16" onClick={() => {
            const w = crop.height * (9/16);
            setCrop({ ...crop, width: Math.min(w, 1 - crop.x) });
          }} />
          <PresetButton title="Snap to square aspect ratio" label="1:1" onClick={() => {
            const size = Math.min(crop.width, crop.height);
            setCrop({ ...crop, width: size, height: size });
          }} />
          <PresetButton title="Reset crop window to full view" label="Reset" onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })} />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            title="Discard crop changes"
            className="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onApply(crop)}
            title="Save crop settings"
            className="px-6 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};

function Handle({ position, onMouseDown }: { position: string, onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div 
      onMouseDown={onMouseDown}
      className={`${position} bg-white border-2 border-blue-600 rounded-sm z-50 hover:scale-125 transition-transform`}
      style={{ width: '8px', height: '8px' }}
    />
  );
}

function PresetButton({ label, onClick, title }: any) {
  return (
    <button title={title} onClick={onClick} className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-blue-400 transition-colors">
      {label}
    </button>
  );
}
