import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Moon, Type } from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';

export function SettingsModal({ open, onClose }: { open: boolean, onClose: () => void }) {
  const { theme, setTheme, fontSize, setFontSize } = useWorkspaceStore();

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
          className="bg-[#121212] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings2 size={20} className="text-blue-500" /> Preferences</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          
          <div className="space-y-6">
             <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Moon size={14}/> Appearance</h3>
                <select 
                   value={theme}
                   onChange={e => setTheme(e.target.value as any)}
                   className="w-full bg-[#1A1A1A] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none"
                >
                   <option value="dark">Dark (Default)</option>
                   <option value="darkest">Darkest (OLED)</option>
                   <option value="light">Light</option>
                   <option value="high-contrast">High Contrast</option>
                </select>
             </div>

             <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Type size={14}/> Accessibility</h3>
                <div className="flex items-center gap-4">
                   <span className="text-sm text-gray-400">UI Scale</span>
                   <input 
                      type="range" min="0.8" max="1.5" step="0.1" 
                      value={fontSize} 
                      onChange={e => setFontSize(parseFloat(e.target.value))}
                      className="flex-1 accent-blue-500"
                   />
                   <span className="text-sm text-white font-mono w-12 text-right">{Math.round(fontSize * 100)}%</span>
                </div>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
