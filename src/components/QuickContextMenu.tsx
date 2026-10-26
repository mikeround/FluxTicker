import React from 'react';
import {
  Pause,
  Play,
  Plus,
  Settings,
  Layers,
  Palette,
  Monitor,
  RefreshCw,
} from 'lucide-react';
import {
  ProfilePresetId,
  ThemePreset,
  WindowLayoutMode,
} from '../types/ticker';
import { PROFILE_PRESETS } from '../data/defaultPresets';

interface QuickContextMenuProps {
  x: number;
  y: number;
  globalPaused: boolean;
  activeProfile: ProfilePresetId;
  activeTheme: ThemePreset;
  activeLayout: WindowLayoutMode;
  onClose: () => void;
  onToggleGlobalPause: () => void;
  onQuickAddBand: () => void;
  onSelectProfile: (profileId: ProfilePresetId) => void;
  onSelectTheme: (theme: ThemePreset) => void;
  onSelectLayout: (layout: WindowLayoutMode) => void;
  onRefreshAllSources: () => void;
  onOpenAdminPanel: (tab?: string) => void;
}

export const QuickContextMenu: React.FC<QuickContextMenuProps> = ({
  x,
  y,
  globalPaused,
  activeProfile,
  activeTheme,
  activeLayout,
  onClose,
  onToggleGlobalPause,
  onQuickAddBand,
  onSelectProfile,
  onSelectTheme,
  onSelectLayout,
  onRefreshAllSources,
  onOpenAdminPanel,
}) => {
  // Clamp coordinates so menu stays within viewport
  const safeX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 270) : x;
  const safeY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 440) : y;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        role="menu"
        aria-label="Menú rápido de Flux Ticker"
        style={{ left: `${Math.max(8, safeX)}px`, top: `${Math.max(8, safeY)}px` }}
        onClick={(e) => e.stopPropagation()}
        className="fixed w-64 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl py-2 text-xs text-slate-200 select-none"
      >
        <div className="px-3 py-1.5 text-[11px] font-mono text-slate-400 border-b border-slate-800/80 flex items-center justify-between">
          <span>FLUX TICKER</span>
          <span>CONTROL DISCRETO</span>
        </div>

        <div className="py-1 border-b border-slate-800/80">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onToggleGlobalPause();
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800/80 text-left transition-colors cursor-pointer"
          >
            {globalPaused ? (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Pause className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{globalPaused ? 'Reanudar todas las bandas' : 'Pausa general de bandas'}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onQuickAddBand();
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800/80 text-left transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Crear nueva banda rápida...</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRefreshAllSources();
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-800/80 text-left transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Actualizar todas las fuentes ahora</span>
          </button>
        </div>

        {/* Quick Profiles */}
        <div className="py-1.5 px-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1.5">
            <Layers className="w-3 h-3" />
            <span>Perfiles Operativos</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(PROFILE_PRESETS) as ProfilePresetId[]).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => {
                  onSelectProfile(pid);
                  onClose();
                }}
                className={`px-2 py-1 rounded text-left truncate transition-colors cursor-pointer ${
                  activeProfile === pid
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                {PROFILE_PRESETS[pid].name}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Themes */}
        <div className="py-1.5 px-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1.5">
            <Palette className="w-3 h-3" />
            <span>Tema Visual</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ['DARK', 'Oscuro'],
                ['LIGHT', 'Claro'],
                ['MONOCHROME', 'Monocromo'],
                ['CUSTOM', 'Personalizado'],
              ] as Array<[ThemePreset, string]>
            ).map(([tId, label]) => (
              <button
                key={tId}
                type="button"
                onClick={() => {
                  onSelectTheme(tId);
                  onClose();
                }}
                className={`px-2 py-1 rounded text-left truncate transition-colors cursor-pointer ${
                  activeTheme === tId
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Screen Positions */}
        <div className="py-1.5 px-3 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase mb-1.5">
            <Monitor className="w-3 h-3" />
            <span>Posición en Pantalla</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(
              [
                ['FULLSCREEN', 'Completa'],
                ['TOP_BAR', 'Franja Superior'],
                ['BOTTOM_BAR', 'Franja Inferior'],
                ['SIDE_COLUMN', 'Columna Lateral'],
                ['COMPACT_FLOAT', 'Ventana Flotante'],
                ['COMPACT_BAR', 'Barra Compacta'],
              ] as Array<[WindowLayoutMode, string]>
            ).map(([mId, label]) => (
              <button
                key={mId}
                type="button"
                onClick={() => {
                  onSelectLayout(mId);
                  onClose();
                }}
                className={`px-2 py-1 rounded text-left truncate transition-colors cursor-pointer ${
                  activeLayout === mId
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenAdminPanel('BANDAS');
              onClose();
            }}
            className="w-full px-3 py-2 flex items-center gap-2.5 text-sky-400 hover:bg-slate-800/80 font-medium text-left transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Abrir Panel de Administración...</span>
          </button>
        </div>
      </div>
    </div>
  );
};
