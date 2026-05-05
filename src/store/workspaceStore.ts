import { create } from 'zustand';

export type WorkspaceLayout = 'editing' | 'color' | 'audio' | 'effects' | 'graphics' | 'all';
export type ThemeMode = 'dark' | 'darkest' | 'light' | 'high-contrast';

interface PanelState {
  id: string;
  isVisible: boolean;
  width?: number; // flex-basis or exact width
  height?: number; // flex-basis or exact height
  docked: 'left' | 'right' | 'bottom' | 'floating'; // simplified
}

interface WorkspaceStore {
  activeLayout: WorkspaceLayout;
  panels: Record<string, PanelState>;
  theme: ThemeMode;
  fontSize: number; // base font size scale
  setActiveLayout: (layout: WorkspaceLayout) => void;
  setTheme: (theme: ThemeMode) => void;
  setFontSize: (size: number) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeLayout: 'editing',
  theme: 'dark',
  fontSize: 1, // multiplier 1=100%
  panels: {
    'project': { id: 'project', isVisible: true, docked: 'left' },
    'source': { id: 'source', isVisible: false, docked: 'left' },
    'program': { id: 'program', isVisible: true, docked: 'right' },
    'timeline': { id: 'timeline', isVisible: true, docked: 'bottom' },
    'properties': { id: 'properties', isVisible: true, docked: 'right' },
    'effects': { id: 'effects', isVisible: false, docked: 'right' },
    'color': { id: 'color', isVisible: false, docked: 'right' },
    'audio': { id: 'audio', isVisible: false, docked: 'right' },
    'graphics': { id: 'graphics', isVisible: false, docked: 'right' },
    'sequenceIndex': { id: 'sequenceIndex', isVisible: false, docked: 'bottom' },
    'markers': { id: 'markers', isVisible: false, docked: 'bottom' },
  },
  setActiveLayout: (layout) => set((state) => {
    // simplified preset logic
    const panels = { ...state.panels };
    
    // reset visibility
    Object.keys(panels).forEach(k => panels[k].isVisible = false);
    panels['timeline'].isVisible = true;
    panels['program'].isVisible = true;

    if (layout === 'editing') {
       panels['project'].isVisible = true;
       panels['properties'].isVisible = true;
    } else if (layout === 'color') {
       panels['color'].isVisible = true;
       panels['properties'].isVisible = true;
    } else if (layout === 'audio') {
       panels['audio'].isVisible = true;
       panels['properties'].isVisible = true;
    } else if (layout === 'effects') {
       panels['effects'].isVisible = true;
       panels['properties'].isVisible = true;
    } else if (layout === 'graphics') {
       panels['graphics'].isVisible = true;
       panels['properties'].isVisible = true;
    } else if (layout === 'all') {
       Object.keys(panels).forEach(k => panels[k].isVisible = true);
    }
    return { activeLayout: layout, panels };
  }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (fontSize) => set({ fontSize })
}));
