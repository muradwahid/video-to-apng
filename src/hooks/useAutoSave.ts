import React, { useEffect, useRef, useCallback } from 'react';
import { TimelineState } from '../types';
import { saveProject, uploadThumbnail } from '../lib/projectService';

const AUTO_SAVE_INTERVAL_MS = 30 * 1000;   // 30 seconds
const THUMBNAIL_THROTTLE_MS = 120 * 1000;  // 2 minutes

export function useAutoSave(
  state: TimelineState,
  setState: React.Dispatch<React.SetStateAction<TimelineState>>,
  programCanvasRef?: React.RefObject<HTMLCanvasElement>
) {
  const isSaving = useRef(false);
  const lastThumbnail = useRef(0);

  const save = useCallback(async () => {
    if (!state.currentProjectId || isSaving.current) return;
    isSaving.current = true;
    setState(s => ({ ...s, saveStatus: 'saving' }));
    
    try {
      await saveProject(state.currentProjectId, state, state.currentProjectName);

      if (
        programCanvasRef?.current &&
        Date.now() - lastThumbnail.current > THUMBNAIL_THROTTLE_MS
      ) {
        lastThumbnail.current = Date.now();
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        canvas.getContext('2d')!.drawImage(programCanvasRef.current, 0, 0, 480, 270);
        const blob = await new Promise<Blob>((res) =>
          canvas.toBlob((b) => res(b!), 'image/jpeg', 0.82)
        );
        await uploadThumbnail(state.currentProjectId, blob);
      }

      setState(s => ({ ...s, saveStatus: 'saved' }));
      setTimeout(() => setState(s => ({ ...s, saveStatus: 'idle' })), 3000);
    } catch (e) {
      console.error('Auto-save failed:', e);
      setState(s => ({ ...s, saveStatus: 'error' }));
    } finally {
      isSaving.current = false;
    }
  }, [state, setState, programCanvasRef]);

  // Periodic interval
  useEffect(() => {
    const id = setInterval(save, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [save]);

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  // Tab close / navigate away
  useEffect(() => {
    const handler = () => save();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [save]);

  return { saveNow: save };
}
