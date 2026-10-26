import React from 'react';
import {
  X,
  Rows3,
  Rss,
  Palette,
  Gauge,
  Monitor,
  Database,
  Layers,
  FileJson,
} from 'lucide-react';
import {
  AppConfiguration,
  BandConfig,
  BandStyleConfig,
  FeedSource,
  GlobalMotionConfig,
  ProfilePresetId,
  WindowDisplayConfig,
} from '../types/ticker';
import { BandsTab } from './admin/BandsTab';
import { SourcesTab } from './admin/SourcesTab';
import {
  AppearanceTab,
  MotionTab,
  ScreenTab,
} from './admin/AppearanceMotionScreenTabs';
import {
  DataTab,
  ProfilesTab,
  SystemExportTab,
} from './admin/DataProfilesSystemTabs';

export type AdminTabId =
  | 'BANDAS'
  | 'FUENTES'
  | 'ASPECTO'
  | 'MOVIMIENTO'
  | 'PANTALLA'
  | 'DATOS'
  | 'PERFILES'
  | 'EXPORTAR';

interface AdminDrawerPanelProps {
  isOpen: boolean;
  activeTab: AdminTabId;
  selectedBandId: string | null;
  config: AppConfiguration;
  onClose: () => void;
  onSelectTab: (tab: AdminTabId) => void;
  onSelectBandId: (bandId: string | null) => void;
  onUpdateConfig: (patch: Partial<AppConfiguration>) => void;
  onUpdateBands: (bands: BandConfig[]) => void;
  onUpdateSources: (sources: FeedSource[]) => void;
  onRefreshSource: (source: FeedSource) => Promise<void>;
  onRefreshAll: () => void;
  onApplyGlobalStyleToAllBands: (stylePatch: Partial<BandStyleConfig>) => void;
  onResetAllBandStyles: () => void;
  onSelectProfilePreset: (id: ProfilePresetId) => void;
  onSaveCustomProfileSnapshot: (name: string, description: string) => void;
  onLoadCustomProfileSnapshot: (snapshotId: string) => void;
  onDeleteCustomProfileSnapshot: (snapshotId: string) => void;
  onResetFactoryDefaults: () => void;
}

const ADMIN_TABS: Array<{ id: AdminTabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'BANDAS', label: 'Bandas', icon: Rows3 },
  { id: 'FUENTES', label: 'Fuentes', icon: Rss },
  { id: 'ASPECTO', label: 'Aspecto', icon: Palette },
  { id: 'MOVIMIENTO', label: 'Movimiento', icon: Gauge },
  { id: 'PANTALLA', label: 'Pantalla', icon: Monitor },
  { id: 'DATOS', label: 'Datos', icon: Database },
  { id: 'PERFILES', label: 'Perfiles', icon: Layers },
  { id: 'EXPORTAR', label: 'Sistema / .EXE', icon: FileJson },
];

export const AdminDrawerPanel: React.FC<AdminDrawerPanelProps> = ({
  isOpen,
  activeTab,
  selectedBandId,
  config,
  onClose,
  onSelectTab,
  onSelectBandId,
  onUpdateConfig,
  onUpdateBands,
  onUpdateSources,
  onRefreshSource,
  onRefreshAll,
  onApplyGlobalStyleToAllBands,
  onResetAllBandStyles,
  onSelectProfilePreset,
  onSaveCustomProfileSnapshot,
  onLoadCustomProfileSnapshot,
  onDeleteCustomProfileSnapshot,
  onResetFactoryDefaults,
}) => {
  if (!isOpen) return null;

  const handleUpdateMotion = (patch: Partial<GlobalMotionConfig>) => {
    onUpdateConfig({ motion: { ...config.motion, ...patch } });
  };

  const handleUpdateWindow = (patch: Partial<WindowDisplayConfig>) => {
    onUpdateConfig({ window: { ...config.window, ...patch } });
  };

  const handleApplyPauseOnHoverAll = (pauseOnHover: boolean) => {
    onUpdateBands(
      config.bands.map((b) => ({
        ...b,
        style: { ...b.style, pauseOnHover },
      }))
    );
  };

  return (
    <aside
      aria-label="Panel de administración de Flux Ticker"
      className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-slate-950/95 backdrop-blur-md border-l border-slate-800 shadow-2xl flex flex-col text-slate-100"
    >
      {/* Drawer Header */}
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-white">
            Panel de Administración — Flux Ticker
          </h2>
          <p className="text-[11px] text-slate-400">
            Cualquier ajuste se previsualiza inmediatamente sobre las bandas activas.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel de administración"
          className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded flex items-center gap-1.5 cursor-pointer"
        >
          <span>Ocultar panel</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Single-Line Navigation Tabs */}
      <nav
        aria-label="Secciones de configuración"
        className="px-3 py-2 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center gap-1 shrink-0"
      >
        {ADMIN_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              className={`px-2.5 py-1.5 rounded text-[11px] font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-sky-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Scrollable Tab Viewport */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'BANDAS' && (
          <BandsTab
            bands={config.bands}
            sources={config.sources}
            selectedBandId={selectedBandId}
            onSelectBandId={onSelectBandId}
            onUpdateBands={onUpdateBands}
          />
        )}

        {activeTab === 'FUENTES' && (
          <SourcesTab
            sources={config.sources}
            onUpdateSources={onUpdateSources}
            onRefreshSource={onRefreshSource}
          />
        )}

        {activeTab === 'ASPECTO' && (
          <AppearanceTab
            config={config}
            onUpdateConfig={onUpdateConfig}
            onApplyGlobalStyleToAllBands={onApplyGlobalStyleToAllBands}
            onResetAllBandStyles={onResetAllBandStyles}
          />
        )}

        {activeTab === 'MOVIMIENTO' && (
          <MotionTab
            motion={config.motion}
            onUpdateMotion={handleUpdateMotion}
            onApplyPauseOnHoverAll={handleApplyPauseOnHoverAll}
          />
        )}

        {activeTab === 'PANTALLA' && (
          <ScreenTab
            windowConfig={config.window}
            onUpdateWindow={handleUpdateWindow}
          />
        )}

        {activeTab === 'DATOS' && (
          <DataTab
            config={config}
            onUpdateConfig={onUpdateConfig}
            onRefreshAll={onRefreshAll}
          />
        )}

        {activeTab === 'PERFILES' && (
          <ProfilesTab
            config={config}
            onSelectProfilePreset={onSelectProfilePreset}
            onSaveCustomProfileSnapshot={onSaveCustomProfileSnapshot}
            onLoadCustomProfileSnapshot={onLoadCustomProfileSnapshot}
            onDeleteCustomProfileSnapshot={onDeleteCustomProfileSnapshot}
          />
        )}

        {activeTab === 'EXPORTAR' && (
          <SystemExportTab
            config={config}
            onImportFullConfig={(newCfg) => onUpdateConfig(newCfg)}
            onResetFactoryDefaults={onResetFactoryDefaults}
          />
        )}
      </div>
    </aside>
  );
};
