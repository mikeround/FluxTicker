import React from 'react';
import { RotateCcw, Monitor, Pause, Play } from 'lucide-react';
import {
  AppConfiguration,
  BandStyleConfig,
  GlobalMotionConfig,
  ThemePreset,
  WindowDisplayConfig,
  WindowLayoutMode,
} from '../../types/ticker';

interface AppearanceTabProps {
  config: AppConfiguration;
  onUpdateConfig: (patch: Partial<AppConfiguration>) => void;
  onApplyGlobalStyleToAllBands: (stylePatch: Partial<BandStyleConfig>) => void;
  onResetAllBandStyles: () => void;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  config,
  onUpdateConfig,
  onApplyGlobalStyleToAllBands,
  onResetAllBandStyles,
}) => {
  return (
    <div className="space-y-6">
      {/* Section 5: Themes */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="text-xs font-semibold text-slate-200">
          Temas visuales y ergonomía cromática
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(
            [
              {
                id: 'DARK',
                title: 'Oscuro',
                desc: 'Fondo negro/gris casi negro, letras claras y acentos tenues diferenciados por banda.',
              },
              {
                id: 'LIGHT',
                title: 'Claro',
                desc: 'Fondo blanco o blanco cálido con texto negro y colores de contraste accesible.',
              },
              {
                id: 'MONOCHROME',
                title: 'Monocromático',
                desc: 'Todas las bandas unificadas bajo un único color configurable de bajo impacto visual.',
              },
              {
                id: 'CUSTOM',
                title: 'Personalizado',
                desc: 'Selección libre de fondo, texto, acento, tipografía, separadores y bordes.',
              },
            ] as Array<{ id: ThemePreset; title: string; desc: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onUpdateConfig({ theme: t.id })}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                config.theme === t.id
                  ? 'bg-sky-500/15 border-sky-500/60 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="text-xs font-semibold">{t.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{t.desc}</div>
            </button>
          ))}
        </div>

        {config.theme === 'MONOCHROME' && (
          <div className="pt-2 flex items-center gap-3">
            <label className="text-xs text-slate-300">
              Color monocromático global:
            </label>
            <input
              type="color"
              value={config.monochromeColor}
              onChange={(e) => onUpdateConfig({ monochromeColor: e.target.value })}
              className="w-8 h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
            <span className="text-xs font-mono text-sky-400">
              {config.monochromeColor}
            </span>
          </div>
        )}

        {config.theme === 'CUSTOM' && (
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Fondo</label>
              <input
                type="color"
                value={config.customThemeBg}
                onChange={(e) => onUpdateConfig({ customThemeBg: e.target.value })}
                className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Texto</label>
              <input
                type="color"
                value={config.customThemeText}
                onChange={(e) => onUpdateConfig({ customThemeText: e.target.value })}
                className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Acento</label>
              <input
                type="color"
                value={config.customThemeAccent}
                onChange={(e) => onUpdateConfig({ customThemeAccent: e.target.value })}
                className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Bordes</label>
              <input
                type="color"
                value={config.customThemeBorder}
                onChange={(e) => onUpdateConfig({ customThemeBorder: e.target.value })}
                className="w-8 h-8 rounded border border-slate-700 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 6: Global Controls to modify all modules simultaneously */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Controles globales de tipografía, dimensiones y separadores
            </div>
            <div className="text-[11px] text-slate-400">
              Modifica todas las bandas simultáneamente con previsualización inmediata.
            </div>
          </div>
          <button
            type="button"
            onClick={onResetAllBandStyles}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar originales
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Tamaño de letra global (px)</span>
              <span className="font-mono text-sky-400">
                {config.bands[0]?.style.fontSize ?? 14} px
              </span>
            </div>
            <input
              type="range"
              min={11}
              max={38}
              value={config.bands[0]?.style.fontSize ?? 14}
              onChange={(e) =>
                onApplyGlobalStyleToAllBands({ fontSize: Number(e.target.value) })
              }
              aria-label="Tamaño de letra global"
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Altura de bandas global (px)</span>
              <span className="font-mono text-sky-400">
                {config.bands[0]?.style.bandHeight ?? 40} px
              </span>
            </div>
            <input
              type="range"
              min={26}
              max={88}
              value={config.bands[0]?.style.bandHeight ?? 40}
              onChange={(e) =>
                onApplyGlobalStyleToAllBands({ bandHeight: Number(e.target.value) })
              }
              aria-label="Altura de bandas global"
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Símbolo separador entre titulares
            </label>
            <select
              value={config.bands[0]?.style.itemSeparatorSymbol ?? '·'}
              onChange={(e) =>
                onApplyGlobalStyleToAllBands({
                  itemSeparatorSymbol: e.target.value as BandStyleConfig['itemSeparatorSymbol'],
                })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
            >
              <option value="·">Punto medio ( · )</option>
              <option value="/">Barra oblicua ( / )</option>
              <option value="|">Barra vertical ( | )</option>
              <option value="—">Raya larga ( — )</option>
              <option value="•">Viñeta discreta ( • )</option>
            </select>
          </div>

          <div className="flex items-end pb-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.bands[0]?.style.showIcons ?? true}
                onChange={(e) =>
                  onApplyGlobalStyleToAllBands({ showIcons: e.target.checked })
                }
                className="rounded border-slate-700 bg-slate-950 text-sky-400"
              />
              <span>Combinar iconos discretos (o desmarcar para sólo texto)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MotionTabProps {
  motion: GlobalMotionConfig;
  onUpdateMotion: (patch: Partial<GlobalMotionConfig>) => void;
  onApplyPauseOnHoverAll: (pauseOnHover: boolean) => void;
}

export const MotionTab: React.FC<MotionTabProps> = ({
  motion,
  onUpdateMotion,
  onApplyPauseOnHoverAll,
}) => {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Motor de desplazamiento continuo y rendimiento
            </div>
            <div className="text-[11px] text-slate-400">
              Animaciones aceleradas por composición (translate3d) sin saltos visibles.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUpdateMotion({ globalPaused: !motion.globalPaused })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded cursor-pointer ${
              motion.globalPaused
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}
          >
            {motion.globalPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                Reanudar todas las bandas
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pausa general
              </>
            )}
          </button>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300">
              Multiplicador global de velocidad ({motion.speedMultiplier.toFixed(2)}x)
            </span>
            <input
              type="number"
              step={0.05}
              min={0.2}
              max={3.0}
              value={motion.speedMultiplier}
              onChange={(e) =>
                onUpdateMotion({
                  speedMultiplier: Math.max(0.2, Math.min(3.0, Number(e.target.value) || 1)),
                })
              }
              aria-label="Multiplicador global de velocidad"
              className="w-20 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
            />
          </div>
          <input
            type="range"
            min={0.25}
            max={2.5}
            step={0.05}
            value={motion.speedMultiplier}
            onChange={(e) => onUpdateMotion({ speedMultiplier: Number(e.target.value) })}
            className="w-full accent-sky-400"
          />
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-800">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={motion.pauseAllOnWindowBlur}
              onChange={(e) => onUpdateMotion({ pauseAllOnWindowBlur: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>
              Congelar renderizado de animaciones cuando la ventana o pestaña esté oculta (ahorro CPU/GPU)
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={motion.respectReducedMotion}
              onChange={(e) => onUpdateMotion({ respectReducedMotion: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>
              Respetar preferencia de movimiento reducido del sistema operativo (prefers-reduced-motion)
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => onApplyPauseOnHoverAll(true)}
              className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 cursor-pointer"
            >
              Activar pausa al pasar el cursor en todas las bandas
            </button>
            <button
              type="button"
              onClick={() => onApplyPauseOnHoverAll(false)}
              className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 cursor-pointer"
            >
              Desactivar pausa al pasar el cursor en todas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ScreenTabProps {
  windowConfig: WindowDisplayConfig;
  onUpdateWindow: (patch: Partial<WindowDisplayConfig>) => void;
}

export const ScreenTab: React.FC<ScreenTabProps> = ({
  windowConfig,
  onUpdateWindow,
}) => {
  const layoutModes: Array<{ id: WindowLayoutMode; label: string; desc: string }> = [
    { id: 'FULLSCREEN', label: 'Pantalla completa', desc: 'Ocupa todo el espacio de visualización disponible.' },
    { id: 'WINDOWED', label: 'Ventana normal redimensionable', desc: 'Marco ajustable con controles de dimensión.' },
    { id: 'TOP_BAR', label: 'Franja superior del escritorio', desc: 'Anclado en el borde superior del monitor.' },
    { id: 'BOTTOM_BAR', label: 'Franja inferior', desc: 'Anclado en la parte inferior de la pantalla.' },
    { id: 'SIDE_COLUMN', label: 'Columna lateral', desc: 'Disposición compacta en el lateral del monitor.' },
    { id: 'COMPACT_FLOAT', label: 'Ventana flotante compacta', desc: 'Módulo arrastrable de dimensiones reducidas.' },
    { id: 'COMPACT_BAR', label: 'Modo barra compacta', desc: 'Muestra únicamente las bandas marcadas como prioritarias.' },
    { id: 'VERTICAL_SCREEN', label: 'Pantalla vertical (Portrait)', desc: 'Optimizado para monitores rotados 9:16.' },
    { id: 'KIOSK', label: 'Modo Quiosco Informativo', desc: 'Oculta controles de edición para pantallas públicas.' },
  ];

  const handleToggleNativeFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Disposición en pantalla y gestión avanzada de ventanas
            </div>
            <div className="text-[11px] text-slate-400">
              Adaptable a 1080p, 1440p, 4K, ultrapanorámicas, pantallas verticales y móviles.
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleNativeFullscreen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            Alternar Pantalla Completa SO
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {layoutModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onUpdateWindow({ layoutMode: m.id })}
              className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                windowConfig.layoutMode === m.id
                  ? 'bg-sky-500/15 border-sky-500/60 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <div className="text-xs font-semibold">{m.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{m.desc}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Selección de monitor destino
            </label>
            <select
              value={windowConfig.targetMonitor}
              onChange={(e) =>
                onUpdateWindow({
                  targetMonitor: e.target.value as WindowDisplayConfig['targetMonitor'],
                })
              }
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
            >
              <option value="PRIMARY">Monitor Principal (1080p / 1440p)</option>
              <option value="SECONDARY_2">Segundo Monitor Auxiliar</option>
              <option value="TV_DISPLAY">Televisor / Pantalla Sala (4K)</option>
              <option value="ULTRAWIDE">Monitor Ultrapanorámico (21:9 / 32:9)</option>
              <option value="VERTICAL_PORTRAIT">Monitor Vertical (9:16)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">Escalado DPI ({windowConfig.dpiScale.toFixed(2)}x)</span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.75}
              step={0.05}
              value={windowConfig.dpiScale}
              onChange={(e) => onUpdateWindow({ dpiScale: Number(e.target.value) })}
              aria-label="Escalado DPI"
              className="w-full accent-sky-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-300">
                Opacidad de ventana ({Math.round(windowConfig.windowOpacity * 100)}%)
              </span>
            </div>
            <input
              type="range"
              min={0.35}
              max={1.0}
              step={0.05}
              value={windowConfig.windowOpacity}
              onChange={(e) => onUpdateWindow({ windowOpacity: Number(e.target.value) })}
              aria-label="Opacidad de ventana"
              className="w-full accent-sky-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={windowConfig.alwaysOnTop}
              onChange={(e) => onUpdateWindow({ alwaysOnTop: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>Modo siempre visible (Always on Top en versión escritorio)</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={windowConfig.borderless}
              onChange={(e) => onUpdateWindow({ borderless: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>Modo ventana sin bordes (Borderless)</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={windowConfig.rememberPosition}
              onChange={(e) => onUpdateWindow({ rememberPosition: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>Memorizar dimensiones y posición persistentemente</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={windowConfig.draggableWindow}
              onChange={(e) => onUpdateWindow({ draggableWindow: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>Permitir posicionamiento mediante arrastre en modos flotantes</span>
          </label>
        </div>
      </div>
    </div>
  );
};
