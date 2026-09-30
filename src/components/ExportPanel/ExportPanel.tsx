import {
  Download,
  Copy,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import {
  useExportStore,
  ExportResolution,
  ExportBackground,
} from '@/store/useExportStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { RESOLUTION_DIMENSIONS } from '@/lib/exportImage';

const RESOLUTIONS: { id: ExportResolution; label: string }[] = [
  { id: '1080p', label: '1080p' },
  { id: '2K', label: '2K' },
  { id: '4K', label: '4K' },
];

const BACKGROUNDS: { id: ExportBackground; label: string; swatch: string }[] = [
  { id: 'transparent', label: '透明', swatch: 'checkerboard' },
  { id: 'dark', label: '深色', swatch: '#0a0a0f' },
  { id: 'gradient', label: '渐变', swatch: 'linear-gradient(135deg,#4c1d95,#312e81 45%,#0a0a0f)' },
];

export function ExportPanel() {
  const settings = useExportStore((state) => state.settings);
  const setSettings = useExportStore((state) => state.setSettings);
  const requestExport = useExportStore((state) => state.requestExport);
  const status = useExportStore((state) => state.status);
  const message = useExportStore((state) => state.message);
  const resultUrl = useExportStore((state) => state.resultUrl);
  const clearResult = useExportStore((state) => state.clearResult);
  const layout = useKeyboardStore((state) => state.layout);

  const rendering = status === 'rendering';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-gray-200">导出高清图片</h3>
      </div>

      {/* Resolution */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2">分辨率</div>
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => {
            const active = settings.resolution === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSettings({ resolution: r.id })}
                className={`px-2 py-2 rounded-lg border text-center transition-all duration-200 ${
                  active
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-gray-800/60 border-gray-700/50 text-gray-300 hover:bg-gray-700/60 hover:border-gray-600/50'
                }`}
              >
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {RESOLUTION_DIMENSIONS[r.id].label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Background */}
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-2">背景</div>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((b) => {
            const active = settings.background === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSettings({ background: b.id })}
                className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border transition-all duration-200 ${
                  active
                    ? 'bg-emerald-600/20 border-emerald-500/50'
                    : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/60 hover:border-gray-600/50'
                }`}
              >
                <span
                  className="w-7 h-7 rounded-md border border-gray-600/50"
                  style={
                    b.swatch === 'checkerboard'
                      ? {
                          backgroundColor: '#1f2937',
                          backgroundImage:
                            'linear-gradient(45deg, #4b5563 25%, transparent 25%), linear-gradient(-45deg, #4b5563 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b5563 75%), linear-gradient(-45deg, transparent 75%, #4b5563 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                        }
                      : { background: b.swatch }
                  }
                />
                <span className="text-xs text-gray-300">{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2 mb-4">
        <ToggleRow
          label="添加水印"
          checked={settings.watermark}
          onChange={(v) => setSettings({ watermark: v })}
        />
        <ToggleRow
          label="2× 超采样抗锯齿（更平滑）"
          checked={settings.pixelRatio === 2}
          onChange={(v) => setSettings({ pixelRatio: v ? 2 : 1 })}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => requestExport('download')}
          disabled={rendering}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all duration-200"
        >
          {rendering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {rendering ? '正在渲染…' : '下载 PNG'}
        </button>
        <button
          onClick={() => requestExport('copy')}
          disabled={rendering}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800/60 hover:bg-gray-700/60 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 text-sm font-medium rounded-xl border border-gray-700/50 transition-all duration-200"
        >
          {rendering ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          复制到剪贴板
        </button>
      </div>

      {/* Status messages */}
      {status === 'error' && message && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-300 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}
      {status === 'success' && message && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 animate-in fade-in duration-200">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {/* Preview */}
      {resultUrl && (
        <div className="mt-3 animate-in fade-in duration-200">
          <div className="text-xs text-gray-400 mb-2">预览</div>
          <div className="relative group rounded-lg overflow-hidden border border-gray-700/50 bg-[#0a0a0f]">
            <img
              src={resultUrl}
              alt="导出预览"
              className="w-full h-auto block"
            />
            <button
              onClick={clearResult}
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              title="关闭预览"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <a
            href={resultUrl}
            download={`keyboard-studio_${layout}.png`}
            className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Download className="w-3 h-3" />
            再次下载
          </a>
        </div>
      )}

      <p className="mt-3 text-[10px] text-gray-500 leading-relaxed">
        按当前 3D 视角渲染高清 PNG，透明背景输出 Alpha 通道。若剪贴板权限被拒绝，将自动改为下载。
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-gray-300 group-hover:text-gray-200 transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-emerald-600' : 'bg-gray-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}
