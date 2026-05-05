import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard } from 'lucide-react';

export function ShortcutsModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#121212] border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Keyboard size={20} className="text-blue-500" /> Keyboard Shortcuts</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          
          <div className="grid grid-cols-2 gap-8 overflow-auto">
             <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Playback & Navigation</h3>
                <div className="space-y-3">
                   <div className="flex justify-between text-xs"><span className="text-white">Play / Pause</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Space</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Frame Reverse</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Left Arrow</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Frame Forward</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Right Arrow</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Go to Start</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Home</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Go to End</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">End</span></div>
                </div>
             </div>
             <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Tools & Editing</h3>
                <div className="space-y-3">
                   <div className="flex justify-between text-xs"><span className="text-white">Selection Tool</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">V</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Razor / Cut Tool</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">C</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Split at Playhead</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">S</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Delete Selected</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Del / Backspace</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Add Marker</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">M</span></div>
                   <div className="flex justify-between text-xs"><span className="text-white">Undo / Redo</span><span className="text-gray-400 font-mono bg-white/5 px-1.5 py-0.5 rounded">Ctrl Z / Y</span></div>
                </div>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
