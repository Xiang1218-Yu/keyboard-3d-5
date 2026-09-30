import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ImageDown,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  copyBlobToClipboard,
  downloadBlob,
  exportSceneImage,
  ExportBackground,
  ExportResolution,
  RESOLUTION_OPTIONS,
} from '@/lib/exporter';
import { useKeyboardStore } from '@/store/useKeyboardStore';

type BusyMode = 'download' | 'copy' | null;

interface StatusMessage {
  type: 'success' | 'error' | 'notice';
  text: string;
}

const BACKGROUND_OPTIONS: Array<{
  id: ExportBackground;
  label: string;
  swatchStyle: React.CSSProperties;
}> = [
  {
    id: 'transparent',
    label: '透明',
    swatchStyle: {
      backgroundColor: '#6b7280',
      backgroundImage:
        'linear-gradient(45deg, #4b5563 25%, transparent 25%), linear-gradient(-45deg, #4b5563 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b5563 75%), linear-gradient(-45deg, transparent 75%, #4b5563 75%)',
      backgroundSize: '8px 8px',
      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
    },
  },
  {
    id: 'dark',
    label: '深色',
    swatchStyle: { backgroundColor: '#0a0a0f' },
  },
  {
    id: 'gradient',
    label: '渐变',
    swatchStyle: {
      background:
        'linear-gradient(135deg, rgba(49,46,129,0.9) 0%, #0a0a0f 50%, rgba(88,28,135,0.9) 100%)',
    },
  },
];

export function ExportPanel() {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>('2k');
  const [background, setBackground] = useState<ExportBackground>('dark');
  const [watermark, setWatermark] = useState(true);
  const [busy, setBusy] = useState<BusyMode>(null);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const statusTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimer.current !== null) {
        window.clearTimeout(statusTimer.current);
      }
    };
  }, []);

  const showStatus = (message: StatusMessage) => {
    setStatus(message);
    if (statusTimer.current !== null) {
      window.clearTimeout(statusTimer.current);
    }
    statusTimer.current = window.setTimeout(() => setStatus(null), 5000);
  };

  const runExport = async (mode: 'download' | 'copy') => {
    if (busy) return;
    setBusy(mode);
    setStatus(null);
    try {
      const result = await exportSceneImage({ resolution, background, watermark });
      const layout = useKeyboardStore.getState().layout.replace('%', 'pct');
      const filename = `keyboard-studio-${layout}-${result.width}x${result.height}.png`;
      const clampNote = result.clamped ? '(受 GPU 限制已缩放)' : '';

      if (mode === 'download') {
        downloadBlob(result.blob, filename);
        showStatus({
          type: 'success',
          text: `已导出 ${result.width}×${result.height} PNG ${clampNote}`,
        });
      } else {
        try {
          await copyBlobToClipboard(result.blob);
          showStatus({
            type: 'success',
            text: `已复制 ${result.width}×${result.height} PNG,可直接粘贴分享 ${clampNote}`,
          });
        } catch {
          // 剪贴板权限被拒或环境不支持时,回退为下载
          downloadBlob(result.blob, filename);
          showStatus({
            type: 'notice',
            text: '剪贴板不可用,已自动为你下载 PNG',
          });
        }
      }
    } catch (error) {
      showStatus({
        type: 'error',
        text: error instanceof Error ? error.message : '导出失败,请重试',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <div className="absolute top-6 right-6 z-20 flex flex-col items-end">
        <button
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md text-sm font-medium transition-all',
            open
              ? 'bg-indigo-500/80 border-indigo-400/50 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-gray-900/40 border-gray-700/30 text-gray-200 hover:bg-gray-800/60 hover:border-gray-600/40'
          )}
        >
          <ImageDown className="w-4 h-4" />
          导出图片
        </button>

        {open && (
          <div className="mt-3 w-72 rounded-2xl border border-gray-700/40 bg-gray-900/80 backdrop-blur-xl shadow-2xl p-4 space-y-4 animate-in slide-in-from-bottom-2 fade-in">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">导出高清图片</div>
                <div className="text-[11px] text-gray-400">与当前视角和配色保持一致</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 transition-all"
                aria-label="关闭导出面板"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-gray-400">分辨率</div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-gray-800/50 rounded-lg">
                {RESOLUTION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setResolution(option.id)}
                    className={cn(
                      'px-1 py-1.5 rounded-md text-center transition-all',
                      resolution === option.id
                        ? 'bg-indigo-500/80 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200'
                    )}
                  >
                    <div className="text-xs font-semibold leading-tight">{option.label}</div>
                    <div className="text-[10px] opacity-70 leading-tight">
                      {option.width}×{option.height}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-gray-400">背景</div>
              <div className="grid grid-cols-3 gap-2">
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setBackground(option.id)}
                    className={cn(
                      'group rounded-lg border p-1.5 transition-all',
                      background === option.id
                        ? 'border-indigo-400/70 bg-indigo-500/10'
                        : 'border-gray-700/50 hover:border-gray-600/60 bg-gray-800/30'
                    )}
                  >
                    <div
                      className="h-8 w-full rounded-md border border-black/30"
                      style={option.swatchStyle}
                    />
                    <div
                      className={cn(
                        'mt-1 text-center text-[11px]',
                        background === option.id ? 'text-indigo-200' : 'text-gray-400'
                      )}
                    >
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setWatermark((value) => !value)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition-all"
            >
              <span className="text-xs text-gray-300">添加水印</span>
              <span
                className={cn(
                  'relative w-8 h-[18px] rounded-full transition-colors',
                  watermark ? 'bg-indigo-500' : 'bg-gray-600'
                )}
              >
                <span
                  className={cn(
                    'absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white shadow transition-all',
                    watermark ? 'left-[16px]' : 'left-[2px]'
                  )}
                />
              </span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => runExport('download')}
                disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {busy === 'download' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                下载 PNG
              </button>
              <button
                onClick={() => runExport('copy')}
                disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-600/50 bg-gray-800/50 text-gray-200 text-xs font-semibold hover:bg-gray-700/50 hover:border-gray-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {busy === 'copy' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                复制图片
              </button>
            </div>

            {status && (
              <div
                className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed animate-in fade-in',
                  status.type === 'success' && 'bg-emerald-500/10 text-emerald-300',
                  status.type === 'error' && 'bg-red-500/10 text-red-300',
                  status.type === 'notice' && 'bg-amber-500/10 text-amber-300'
                )}
              >
                {status.type === 'success' ? (
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                )}
                <span>{status.text}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
