import { create } from 'zustand';

export type ExportResolution = '1080p' | '2K' | '4K';
export type ExportBackground = 'transparent' | 'dark' | 'gradient';
export type ExportAction = 'download' | 'copy';
export type ExportStatus = 'idle' | 'rendering' | 'success' | 'error';

export interface ExportSettings {
  resolution: ExportResolution;
  background: ExportBackground;
  watermark: boolean;
  /** Supersampling multiplier applied to the render target (1 = native, 2 = 2× SSAA). */
  pixelRatio: 1 | 2;
}

interface ExportState {
  settings: ExportSettings;
  status: ExportStatus;
  message: string | null;
  resultUrl: string | null;
  /** Incremented on every export request; the controller watches this to trigger a render. */
  requestId: number;
  lastAction: ExportAction | null;

  setSettings: (partial: Partial<ExportSettings>) => void;
  requestExport: (action: ExportAction) => void;
  clearResult: () => void;
  setStatus: (status: ExportStatus, message?: string | null) => void;
  setResultUrl: (url: string | null) => void;
}

export const useExportStore = create<ExportState>((set, get) => ({
  settings: {
    resolution: '1080p',
    background: 'dark',
    watermark: true,
    pixelRatio: 2,
  },
  status: 'idle',
  message: null,
  resultUrl: null,
  requestId: 0,
  lastAction: null,

  setSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),

  requestExport: (action) => {
    const prev = get().resultUrl;
    if (prev) URL.revokeObjectURL(prev);
    set((state) => ({
      requestId: state.requestId + 1,
      lastAction: action,
      status: 'rendering',
      message: null,
      resultUrl: null,
    }));
  },

  clearResult: () => {
    const prev = get().resultUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ resultUrl: null, status: 'idle', message: null });
  },

  setStatus: (status, message = null) => set({ status, message }),
  setResultUrl: (url) => set({ resultUrl: url }),
}));

export const useExportSettings = () => useExportStore((state) => state.settings);
export const useExportStatus = () => useExportStore((state) => state.status);
