import { useEffect } from 'react';

export type ShortcutAction = 
  | 'PLAY_PAUSE' 
  | 'CUT_CLIP' 
  | 'DELETE_CLIP' 
  | 'UNDO' 
  | 'REDO' 
  | 'SAVE_PROJECT' 
  | 'ADD_MARKER'
  | 'TOGGLE_SHORTCUTS';

type ShortcutMap = Record<string, ShortcutAction>;

const DEFAULT_SHORTCUTS: ShortcutMap = {
  ' ': 'PLAY_PAUSE',
  'c': 'CUT_CLIP',
  'Delete': 'DELETE_CLIP',
  'Backspace': 'DELETE_CLIP',
  'z': 'UNDO', // usually ctrl+z, but we handle modifier later
  's': 'SAVE_PROJECT',
  'm': 'ADD_MARKER',
  '?': 'TOGGLE_SHORTCUTS'
};

export function useShortcuts(onAction: (action: ShortcutAction) => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        // except specific combos, but for now ignore all
        return;
      }
      
      const key = e.key;
      const lowerKey = key.toLowerCase();
      
      let match = DEFAULT_SHORTCUTS[key] || DEFAULT_SHORTCUTS[lowerKey];
      
      if (e.ctrlKey || e.metaKey) {
         if (lowerKey === 'z') match = 'UNDO';
         if (lowerKey === 's') { e.preventDefault(); match = 'SAVE_PROJECT'; }
      }

      if (match) {
        if (key === ' ' || key === 'Backspace') e.preventDefault();
        onAction(match);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAction]);
}
