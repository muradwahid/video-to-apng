import { create } from 'zustand';

export type ExportStatus = 'queued' | 'encoding' | 'done' | 'error';

export interface ExportJob {
  id: string;
  name: string;
  preset: string;
  progress: number;
  status: ExportStatus;
  estimatedTimeRemaining: string;
  blobUrl?: string;
  timelineState: any; // snapshot of timeline
  config: any;
}

interface ExportStore {
  queue: ExportJob[];
  addJob: (job: ExportJob) => void;
  updateJob: (id: string, updates: Partial<ExportJob>) => void;
  removeJob: (id: string) => void;
  clearDone: () => void;
}

export const useExportStore = create<ExportStore>((set) => ({
  queue: [],
  addJob: (job) => set((state) => ({ queue: [...state.queue, job] })),
  updateJob: (id, updates) => set((state) => ({
    queue: state.queue.map(j => j.id === id ? { ...j, ...updates } : j)
  })),
  removeJob: (id) => set((state) => ({ queue: state.queue.filter(j => j.id !== id) })),
  clearDone: () => set((state) => ({ queue: state.queue.filter(j => j.status !== 'done' && j.status !== 'error') }))
}));
