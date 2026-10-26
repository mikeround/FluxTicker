import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Settings,
  Pause,
  Play,
  Plus,
  Layers,
  Move,
  Maximize2,
  Download,
} from 'lucide-react';
import {
  AppConfiguration,
  BandCategory,
  BandConfig,
  BandStyleConfig,
  FeedSource,
  HistoricalLogEntry,
  ProfilePresetId,
  ThemePreset,
  TickerItem,
  WindowLayoutMode,
} from './types/ticker';
import {
  CATEGORY_METADATA,
  createInitialBands,
  DEMO_FALLBACK_ITEMS,
  INITIAL_APP_CONFIG,
  PROFILE_PRESETS,
} from './data/defaultPresets';
import {
  computeWorldClockItems,
  evaluateKeywordAlerts,
  filterAndSortBandItems,
  getDefaultBandStyle,
  validateAppConfig,
} from './utils/tickerEngine';
import { collectHardwareItems } from './utils/hardwareProvider';
import {
  downloadPersonalWindowsExe,
  downloadStandaloneHtmlFile,
  fetchMarketsClientSide,
  fetchRssClientSide,
  fetchWeatherClientSide,
} from './utils/standaloneClientFetcher';
import { TickerBandRow } from './components/TickerBandRow';
import { ItemDetailModal } from './components/ItemDetailModal';
import { QuickContextMenu } from './components/QuickContextMenu';
import { AdminDrawerPanel, AdminTabId } from './components/AdminDrawerPanel';

const STORAGE_KEY_CONFIG = 'flux_ticker_config_v1';
const STORAGE_KEY_FEED_CACHE = 'flux_ticker_offline_items_v1';

export default function App() {
  // 1. Load persistent configuration from localStorage or preloaded .EXE state
  const [config, setConfig] = useState<AppConfiguration>(() => {
    if (typeof window === 'undefined') return INITIAL_APP_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        const check = validateAppConfig(parsed);
        if (check.valid && check.config) {
          return {
            ...INITIAL_APP_CONFIG,
            ...check.config,
          };
        }
      }
      const winAny = window as unknown as Record<string, unknown>;
      if (winAny.__FLUX_PRELOADED_CONFIG__) {
        const check = validateAppConfig(winAny.__FLUX_PRELOADED_CONFIG__);
        if (check.valid && check.config) {
          return {
            ...INITIAL_APP_CONFIG,
            ...check.config,
          };
        }
      }
    } catch {
      // Fallback to initial config
    }
    return INITIAL_APP_CONFIG;
  });

  // 2. Store raw items per sourceId or category in state (persisted for offline operation)
  const [sourceItemsMap, setSourceItemsMap] = useState<Record<string, TickerItem[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = localStorage.getItem(STORAGE_KEY_FEED_CACHE);
      if (cached) return JSON.parse(cached);
      const winAny = window as unknown as Record<string, unknown>;
      if (winAny.__FLUX_PRELOADED_ITEMS__ && typeof winAny.__FLUX_PRELOADED_ITEMS__ === 'object') {
        return winAny.__FLUX_PRELOADED_ITEMS__ as Record<string, TickerItem[]>;
      }
    } catch {
      // Ignore storage error
    }
    return {};
  });

  const [clockTick, setClockTick] = useState<Date>(() => new Date());
  const [hardwareItems, setHardwareItems] = useState<TickerItem[]>([]);
  const [marketItems, setMarketItems] = useState<TickerItem[]>([]);
  const [weatherItems, setWeatherItems] = useState<TickerItem[]>([]);

  // UI Interaction States
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminTabId>('BANDAS');
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [inspectedItem, setInspectedItem] = useState<{
    item: TickerItem;
    band: BandConfig;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');

  // Floating/Windowed mode drag state
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const dragOffsetRef = useRef<{ startX: number; startY: number; origX: number; origY: number }>({
    startX: 0,
    startY: 0,
    origX: 40,
    origY: 40,
  });

  // Persist configuration changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch {
      // Ignore quota errors
    }
  }, [config]);

  // Persist offline feed items cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FEED_CACHE, JSON.stringify(sourceItemsMap));
    } catch {
      // Ignore quota errors
    }
  }, [sourceItemsMap]);

  const updateConfig = useCallback((patch: Partial<AppConfiguration>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateBands = useCallback((bands: BandConfig[]) => {
    setConfig((prev) => ({ ...prev, bands }));
  }, []);

  const updateSources = useCallback((sources: FeedSource[]) => {
    setConfig((prev) => ({ ...prev, sources }));
  }, []);

  // 3. World Clocks 1-second local precision timer
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Hardware Telemetry Polling (Local Agent or honest Web N/D fallback)
  const refreshHardware = useCallback(async () => {
    const hwBand = config.bands.find((b) => b.category === 'HARDWARE');
    const { items, agentConnected } = await collectHardwareItems(
      hwBand?.id || 'band-hardware',
      config.hardwareAgent,
      hwBand?.hardwareThresholds
    );
    setHardwareItems(items);
    if (agentConnected !== config.hardwareAgent.connected) {
      setConfig((prev) => ({
        ...prev,
        hardwareAgent: {
          ...prev.hardwareAgent,
          connected: agentConnected,
          lastSeen: agentConnected ? new Date().toISOString() : prev.hardwareAgent.lastSeen,
        },
      }));
    }
  }, [config.bands, config.hardwareAgent]);

  useEffect(() => {
    void refreshHardware();
    const intervalMs = Math.max(2000, config.hardwareAgent.pollIntervalMs || 4000);
    const timer = setInterval(() => {
      void refreshHardware();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [refreshHardware, config.hardwareAgent.pollIntervalMs]);

  // 5. Markets Polling (with automatic client-side fallback for standalone .html mode)
  const refreshMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/markets?bandId=band-markets');
      if (!res.ok) throw new Error('Backend unavailable');
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setMarketItems(data.items);
        return;
      }
    } catch {
      const fallback = await fetchMarketsClientSide('band-markets');
      if (fallback.length > 0) setMarketItems(fallback);
    }
  }, []);

  useEffect(() => {
    void refreshMarkets();
    const timer = setInterval(() => {
      void refreshMarkets();
    }, 60_000);
    return () => clearInterval(timer);
  }, [refreshMarkets]);

  // 6. Weather Polling via Open-Meteo (with direct client-side fallback for standalone .html mode)
  const refreshWeather = useCallback(async () => {
    const metBand = config.bands.find((b) => b.category === 'METEOROLOGIA');
    const cities = metBand?.weatherCities || [
      { id: 'w-mad', name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
      { id: 'w-lon', name: 'Londres', latitude: 51.5074, longitude: -0.1278 },
      { id: 'w-nyc', name: 'Nueva York', latitude: 40.7128, longitude: -74.006 },
      { id: 'w-tok', name: 'Tokio', latitude: 35.6762, longitude: 139.6503 },
    ];
    const citiesQuery = encodeURIComponent(JSON.stringify(cities));
    try {
      const res = await fetch(
        `/api/weather?bandId=${metBand?.id || 'band-meteorologia'}&cities=${citiesQuery}`
      );
      if (!res.ok) throw new Error('Backend unavailable');
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setWeatherItems(data.items);
        return;
      }
    } catch {
      const directWeather = await fetchWeatherClientSide(
        metBand?.id || 'band-meteorologia',
        cities
      );
      if (directWeather.length > 0) setWeatherItems(directWeather);
    }
  }, [config.bands]);

  useEffect(() => {
    void refreshWeather();
    const timer = setInterval(() => {
      void refreshWeather();
    }, 300_000);
    return () => clearInterval(timer);
  }, [refreshWeather]);

  // 7. RSS / Atom / JSON Feed Source Fetcher (with standalone .html fallback)
  const refreshSingleSource = useCallback(async (source: FeedSource) => {
    if (!source.enabled || source.trustLevel === 'BLOCKED') return;
    if (
      source.format !== 'RSS' &&
      source.format !== 'ATOM' &&
      source.format !== 'JSON_FEED' &&
      !(source.format === 'API_JSON' && source.category !== 'MERCADOS' && source.category !== 'METEOROLOGIA')
    ) {
      return;
    }

    try {
      const params = new URLSearchParams({
        url: source.url,
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        language: source.language || 'es',
        country: source.country || 'ES',
      });
      const res = await fetch(`/api/rss?${params.toString()}`);
      if (!res.ok) throw new Error('Backend unavailable');
      const data = await res.json();

      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setSourceItemsMap((prev) => ({
          ...prev,
          [source.id]: data.items,
        }));

        setConfig((prev) => {
          const updatedSources = prev.sources.map((s) =>
            s.id === source.id
              ? {
                  ...s,
                  lastUpdated: data.updatedAt || new Date().toISOString(),
                  lastStatus: data.freshness || 'DIRECTO',
                  itemCount: data.items.length,
                  lastError: undefined,
                }
              : s
          );

          const newLogEntries: HistoricalLogEntry[] = (data.items as TickerItem[])
            .slice(0, 2)
            .map((it) => ({
              id: `log-${it.id}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              bandName: CATEGORY_METADATA[source.category].label,
              category: source.category,
              title: it.title,
              sourceName: source.name,
              freshness: data.freshness || 'DIRECTO',
            }));

          const combinedLog = [...newLogEntries, ...prev.historyLog].slice(
            0,
            prev.maxHistoryEntries || 150
          );

          return {
            ...prev,
            sources: updatedSources,
            historyLog: combinedLog,
          };
        });
        return;
      }
    } catch {
      const fallbackRss = await fetchRssClientSide(source, 'band-default');
      if (fallbackRss.items.length > 0) {
        setSourceItemsMap((prev) => ({
          ...prev,
          [source.id]: fallbackRss.items,
        }));
      }
    }
  }, []);

  const refreshAllSources = useCallback(() => {
    void refreshHardware();
    void refreshMarkets();
    void refreshWeather();
    config.sources.forEach((src) => {
      void refreshSingleSource(src);
    });
  }, [config.sources, refreshHardware, refreshMarkets, refreshWeather, refreshSingleSource]);

  // Initial fetch on mount
  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    config.sources.forEach((src) => {
      void refreshSingleSource(src);
    });
  }, [config.sources, refreshSingleSource]);

  // Build sources Map for fast lookup
  const sourcesMap = useMemo(() => {
    const map = new Map<string, FeedSource>();
    config.sources.forEach((s) => map.set(s.id, s));
    return map;
  }, [config.sources]);

  // Compute resolved items per band with deduplication, filtering, and keyword alerts
  const bandItemsRecord = useMemo(() => {
    const out: Record<string, TickerItem[]> = {};

    for (const band of config.bands) {
      let rawItems: TickerItem[] = [];

      if (band.category === 'RELOJ_MUNDIAL') {
        rawItems = computeWorldClockItems(
          band.id,
          band.worldCities || INITIAL_APP_CONFIG.bands[1].worldCities || [],
          clockTick
        );
      } else if (band.category === 'HARDWARE') {
        rawItems = hardwareItems.map((it) => ({ ...it, bandId: band.id }));
      } else if (band.category === 'MERCADOS') {
        rawItems =
          marketItems.length > 0
            ? marketItems.map((it) => ({ ...it, bandId: band.id }))
            : DEMO_FALLBACK_ITEMS.MERCADOS.map((it) => ({ ...it, bandId: band.id }));
      } else if (band.category === 'METEOROLOGIA') {
        rawItems =
          weatherItems.length > 0
            ? weatherItems.map((it) => ({ ...it, bandId: band.id }))
            : DEMO_FALLBACK_ITEMS.METEOROLOGIA.map((it) => ({ ...it, bandId: band.id }));
      } else if (band.category === 'AGENDA') {
        const events = band.agendaItems || [];
        rawItems = events.map((ev, idx) => ({
          id: `agenda-${ev.id}`,
          bandId: band.id,
          category: 'AGENDA',
          title: ev.title,
          value: ev.time,
          secondaryValue: ev.date,
          subtitle: ev.location ? `Ubicación: ${ev.location}` : undefined,
          sourceName: 'Agenda Autorizada',
          updatedAt: new Date().toISOString(),
          freshness: 'DIRECTO',
          priority: ev.priority === 'URGENT' ? 100 : ev.priority === 'HIGH' ? 80 : 50 - idx,
          alertTriggered: ev.priority === 'URGENT',
        }));
      } else if (band.category === 'PERSONALIZADA') {
        const customList = band.customEntries || [];
        rawItems = customList.map((ce, idx) => ({
          id: `custom-${ce.id}`,
          bandId: band.id,
          category: 'PERSONALIZADA',
          title: ce.label,
          value: ce.value,
          secondaryValue: ce.unit,
          sourceName: 'Módulo Personalizado',
          sourceUrl: ce.url,
          updatedAt: new Date().toISOString(),
          freshness: 'DIRECTO',
          priority: 90 - idx,
        }));
      } else {
        // News / RSS categories: combine items from all assigned sourceIds
        const assignedIds =
          band.sourceIds.length > 0
            ? band.sourceIds
            : config.sources
                .filter((s) => s.category === band.category)
                .map((s) => s.id);

        for (const sId of assignedIds) {
          const sItems = sourceItemsMap[sId];
          if (sItems && sItems.length > 0) {
            rawItems.push(...sItems.map((it) => ({ ...it, bandId: band.id })));
          }
        }

        if (rawItems.length === 0) {
          const demoList = DEMO_FALLBACK_ITEMS[band.category] || DEMO_FALLBACK_ITEMS.ACTUALIDAD;
          rawItems = demoList.map((it) => ({ ...it, bandId: band.id }));
        }
      }

      const filtered = filterAndSortBandItems(rawItems, band, sourcesMap);
      const { updatedItems } = evaluateKeywordAlerts(filtered, config.keywordAlerts);
      out[band.id] = updatedItems;
    }

    return out;
  }, [
    config.bands,
    config.sources,
    config.keywordAlerts,
    clockTick,
    hardwareItems,
    marketItems,
    weatherItems,
    sourceItemsMap,
    sourcesMap,
  ]);

  // Visible sorted bands (respecting COMPACT_BAR mode and group filter)
  const visibleBands = useMemo(() => {
    return [...config.bands]
      .filter((b) => b.enabled && !b.hidden)
      .filter((b) => (config.window.layoutMode === 'COMPACT_BAR' ? Boolean(b.compactSelected) : true))
      .filter((b) => (selectedGroupFilter === 'ALL' ? true : b.group === selectedGroupFilter))
      .sort((a, b) => a.order - b.order);
  }, [config.bands, config.window.layoutMode, selectedGroupFilter]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    config.bands.forEach((b) => {
      if (b.enabled && !b.hidden && b.group) set.add(b.group);
    });
    return Array.from(set);
  }, [config.bands]);

  // Handlers for Profiles, Global Styles, Favorites, and Quick Band Creation
  const handleSelectProfilePreset = (profileId: ProfilePresetId) => {
    const preset = PROFILE_PRESETS[profileId];
    if (!preset) return;

    const updatedBands = config.bands.map((b) => {
      const shouldEnable = preset.enabledCategories.includes(b.category);
      return {
        ...b,
        enabled: shouldEnable,
        hidden: false,
        style: {
          ...b.style,
          fontSize: preset.fontSize,
          bandHeight: preset.bandHeight,
        },
      };
    });

    setConfig((prev) => ({
      ...prev,
      activeProfileId: profileId,
      bands: updatedBands,
      motion: {
        ...prev.motion,
        speedMultiplier: preset.speedMultiplier,
      },
      window: {
        ...prev.window,
        layoutMode: preset.layoutMode,
      },
    }));
  };

  const handleApplyGlobalStyleToAllBands = (stylePatch: Partial<BandStyleConfig>) => {
    setConfig((prev) => ({
      ...prev,
      bands: prev.bands.map((b) => ({
        ...b,
        style: {
          ...b.style,
          ...stylePatch,
        },
      })),
    }));
  };

  const handleResetAllBandStyles = () => {
    setConfig((prev) => ({
      ...prev,
      bands: prev.bands.map((b) => {
        const meta = CATEGORY_METADATA[b.category];
        return {
          ...b,
          style: {
            ...getDefaultBandStyle(prev.theme, meta.darkAccent),
            bgColor: meta.darkBg,
            accentColor: meta.darkAccent,
          },
        };
      }),
    }));
  };

  const handleToggleFavorite = (item: TickerItem) => {
    setConfig((prev) => {
      const exists = prev.favorites.some((f) => f.id === item.id);
      const nextFavs = exists
        ? prev.favorites.filter((f) => f.id !== item.id)
        : [item, ...prev.favorites];
      return { ...prev, favorites: nextFavs };
    });
  };

  const isFavorite = useCallback(
    (itemId: string) => config.favorites.some((f) => f.id === itemId),
    [config.favorites]
  );

  const handleToggleBandPause = (bandId: string) => {
    setConfig((prev) => ({
      ...prev,
      bands: prev.bands.map((b) =>
        b.id === bandId ? { ...b, paused: !b.paused } : b
      ),
    }));
  };

  const handleOpenBandSettings = (bandId: string) => {
    setSelectedBandId(bandId);
    setAdminTab('BANDAS');
    setAdminOpen(true);
  };

  const handleSaveCustomProfileSnapshot = (name: string, description: string) => {
    setConfig((prev) => ({
      ...prev,
      customProfiles: [
        {
          id: `prof-${Date.now()}`,
          name,
          description,
          createdAt: new Date().toISOString(),
          bands: JSON.parse(JSON.stringify(prev.bands)),
          theme: prev.theme,
          windowSettings: { ...prev.window },
        },
        ...prev.customProfiles,
      ],
    }));
  };

  const handleLoadCustomProfileSnapshot = (snapshotId: string) => {
    const snap = config.customProfiles.find((p) => p.id === snapshotId);
    if (!snap) return;
    setConfig((prev) => ({
      ...prev,
      activeProfileId: 'PERSONALIZADO',
      bands: JSON.parse(JSON.stringify(snap.bands)),
      theme: snap.theme,
      window: { ...snap.windowSettings },
    }));
  };

  const handleDeleteCustomProfileSnapshot = (snapshotId: string) => {
    setConfig((prev) => ({
      ...prev,
      customProfiles: prev.customProfiles.filter((p) => p.id !== snapshotId),
    }));
  };

  const handleResetFactoryDefaults = () => {
    setConfig({
      ...INITIAL_APP_CONFIG,
      bands: createInitialBands(),
    });
  };

  // Dragging logic for WINDOWED / COMPACT_FLOAT modes
  const handleStartDragWindow = (e: React.MouseEvent) => {
    if (!config.window.draggableWindow) return;
    setIsDraggingWindow(true);
    dragOffsetRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: config.window.positionX,
      origY: config.window.positionY,
    };
  };

  useEffect(() => {
    if (!isDraggingWindow) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragOffsetRef.current.startX;
      const dy = e.clientY - dragOffsetRef.current.startY;
      setConfig((prev) => ({
        ...prev,
        window: {
          ...prev.window,
          positionX: Math.max(0, dragOffsetRef.current.origX + dx),
          positionY: Math.max(0, dragOffsetRef.current.origY + dy),
        },
      }));
    };
    const onUp = () => setIsDraggingWindow(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDraggingWindow]);

  // Compute layout container classes based on WindowLayoutMode (Section 8)
  const layoutMode = config.window.layoutMode;
  const isFloatingOrWindowed =
    layoutMode === 'WINDOWED' || layoutMode === 'COMPACT_FLOAT';

  const getViewportLayoutClasses = (mode: WindowLayoutMode): string => {
    switch (mode) {
      case 'TOP_BAR':
        return 'fixed top-0 inset-x-0 z-30 shadow-2xl border-b border-slate-800 max-h-[45vh] overflow-y-auto';
      case 'BOTTOM_BAR':
        return 'fixed bottom-0 inset-x-0 z-30 shadow-2xl border-t border-slate-800 max-h-[45vh] overflow-y-auto';
      case 'SIDE_COLUMN':
        return 'fixed top-0 left-0 bottom-0 w-full max-w-md z-30 shadow-2xl border-r border-slate-800 overflow-y-auto';
      case 'VERTICAL_SCREEN':
        return 'mx-auto w-full max-w-[540px] min-h-screen border-x border-slate-800 overflow-y-auto';
      case 'COMPACT_BAR':
        return 'fixed top-0 inset-x-0 z-30 shadow-xl border-b border-slate-800';
      default:
        return 'w-full min-h-screen';
    }
  };

  const rootBgColor =
    config.theme === 'LIGHT'
      ? '#f1f5f9'
      : config.theme === 'CUSTOM'
      ? config.customThemeBg
      : '#060911';

  return (
    <div
      style={{
        backgroundColor: rootBgColor,
        zoom: config.window.dpiScale,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className="relative w-full min-h-screen select-none overflow-x-hidden"
    >
      {/* Discrete Floating Control Trigger in Bottom-Right (never overlaps top bands) */}
      {layoutMode !== 'KIOSK' && (
        <div
          role="region"
          aria-label="Controles discretos de acceso rápido"
          className="fixed bottom-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-950/90 hover:bg-slate-950 backdrop-blur-md border border-slate-800 text-xs text-slate-300 opacity-85 hover:opacity-100 focus-within:opacity-100 transition-opacity shadow-xl"
        >
          {/* Small-screen / Group filter selector when groups exist */}
          {availableGroups.length > 1 && (
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              aria-label="Filtrar grupo de bandas"
              className="bg-transparent text-[11px] text-slate-300 focus:outline-none cursor-pointer pr-1 border-r border-slate-800"
            >
              <option value="ALL" className="bg-slate-950">
                Todas ({config.bands.filter((b) => b.enabled && !b.hidden).length})
              </option>
              {availableGroups.map((g) => (
                <option key={g} value={g} className="bg-slate-950">
                  {g}
                </option>
              ))}
            </select>
          )}

          {/* Active Profile Selector */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('PERFILES');
              setAdminOpen(true);
            }}
            title="Cambiar perfil operativo"
            aria-label={`Perfil activo: ${PROFILE_PRESETS[config.activeProfileId].name}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-3 h-3 text-sky-400" />
            <span className="text-[11px] font-medium">
              {PROFILE_PRESETS[config.activeProfileId].name}
            </span>
          </button>

          {/* Global Pause / Resume Button */}
          <button
            type="button"
            onClick={() =>
              updateConfig({
                motion: {
                  ...config.motion,
                  globalPaused: !config.motion.globalPaused,
                },
              })
            }
            title={
              config.motion.globalPaused
                ? 'Reanudar todas las bandas'
                : 'Pausar todas las bandas'
            }
            aria-label={
              config.motion.globalPaused
                ? 'Reanudar todas las bandas'
                : 'Pausar todas las bandas'
            }
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.motion.globalPaused ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            {config.motion.globalPaused ? (
              <>
                <Play className="w-3 h-3" />
                <span className="text-[11px]">Reanudar</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span className="text-[11px]">Pausar</span>
              </>
            )}
          </button>

          {/* Quick Add Band Button */}
          <button
            type="button"
            onClick={() => {
              setAdminTab('BANDAS');
              setSelectedBandId(null);
              setAdminOpen(true);
            }}
            title="Crear nueva banda o configurar bandas"
            aria-label="Añadir banda"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-sky-400" />
            <span className="text-[11px]">Nueva Banda</span>
          </button>

          {/* Direct 1-Click Download of Personal Windows .EXE with Current Configuration */}
          <button
            type="button"
            onClick={() => {
              void downloadPersonalWindowsExe(config, sourceItemsMap);
            }}
            title="Descargar ejecutable para Windows (.exe) tal y como está configurado ahora (sin licencia y para uso propio)"
            aria-label="Descargar ejecutable Windows .EXE con la configuración actual"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="text-[11px] font-medium">Descargar .EXE</span>
          </button>

          {/* Direct 1-Click Download of Portable .HTML Version */}
          <button
            type="button"
            onClick={() => {
              void downloadStandaloneHtmlFile();
            }}
            title="Descargar versión .HTML autónoma y portable de Flux Ticker"
            aria-label="Descargar versión HTML portable"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span className="text-[11px] font-medium">Descargar .HTML</span>
          </button>

          {/* Open Slide-over Admin Panel Button */}
          <button
            type="button"
            onClick={() => setAdminOpen((prev) => !prev)}
            title="Abrir Panel de Administración (también accesible con clic derecho)"
            aria-label="Configuración"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-400/15 hover:bg-sky-400/25 text-sky-300 border border-sky-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span className="text-[11px] font-medium">Panel</span>
          </button>
        </div>
      )}

      {/* Main Ticker Bands Viewport */}
      <main
        aria-label="Espacio principal de bandas informativas Flux Ticker"
        style={
          isFloatingOrWindowed
            ? {
                position: 'fixed',
                left: `${config.window.positionX}px`,
                top: `${config.window.positionY}px`,
                width:
                  layoutMode === 'COMPACT_FLOAT'
                    ? '680px'
                    : `${config.window.customWidthPx}px`,
                maxWidth: '96vw',
                opacity: config.window.windowOpacity,
              }
            : {
                opacity: config.window.windowOpacity,
              }
        }
        className={
          isFloatingOrWindowed
            ? `z-20 rounded-lg overflow-hidden shadow-2xl ${
                config.window.borderless ? '' : 'border border-slate-700'
              }`
            : getViewportLayoutClasses(layoutMode)
        }
      >
        {/* Optional Drag Handle Bar only when in Windowed or Compact Float Mode */}
        {isFloatingOrWindowed && !config.window.borderless && (
          <div
            onMouseDown={handleStartDragWindow}
            className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 cursor-move"
          >
            <div className="flex items-center gap-2">
              <Move className="w-3 h-3 text-sky-400" />
              <span>FLUX TICKER — MODO VENTANA ARRASTRABLE</span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateConfig({
                  window: { ...config.window, layoutMode: 'FULLSCREEN' },
                })
              }
              aria-label="Restaurar a pantalla completa"
              className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Maximizar</span>
            </button>
          </div>
        )}

        {/* Render Active Horizontal Bands */}
        {visibleBands.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">
              No hay bandas activas en este momento.
            </p>
            <button
              type="button"
              onClick={() => {
                setAdminTab('BANDAS');
                setAdminOpen(true);
              }}
              className="px-4 py-2 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
            >
              Activar o añadir bandas
            </button>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {visibleBands.map((band) => (
              <TickerBandRow
                key={band.id}
                band={band}
                items={bandItemsRecord[band.id] || []}
                theme={config.theme}
                monochromeColor={config.monochromeColor}
                customTheme={{
                  bg: config.customThemeBg,
                  text: config.customThemeText,
                  accent: config.customThemeAccent,
                  border: config.customThemeBorder,
                }}
                globalOverrides={config.globalStyleOverrides}
                motionConfig={config.motion}
                isFavorite={isFavorite}
                onSelectItem={(item, b) => setInspectedItem({ item, band: b })}
                onToggleBandPause={handleToggleBandPause}
                onOpenBandSettings={handleOpenBandSettings}
              />
            ))}
          </div>
        )}
      </main>

      {/* Item Inspector Modal (Select, Copy, Open Original Link, Bookmark, AI Summary) */}
      {inspectedItem && (
        <ItemDetailModal
          item={inspectedItem.item}
          band={inspectedItem.band}
          isFavorite={isFavorite(inspectedItem.item.id)}
          onClose={() => setInspectedItem(null)}
          onToggleFavorite={handleToggleFavorite}
          onConfigureBand={handleOpenBandSettings}
        />
      )}

      {/* Discrete Right-Click Context Menu */}
      {contextMenu && (
        <QuickContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          globalPaused={config.motion.globalPaused}
          activeProfile={config.activeProfileId}
          activeTheme={config.theme}
          activeLayout={config.window.layoutMode}
          onClose={() => setContextMenu(null)}
          onToggleGlobalPause={() =>
            updateConfig({
              motion: {
                ...config.motion,
                globalPaused: !config.motion.globalPaused,
              },
            })
          }
          onQuickAddBand={() => {
            setAdminTab('BANDAS');
            setSelectedBandId(null);
            setAdminOpen(true);
          }}
          onSelectProfile={handleSelectProfilePreset}
          onSelectTheme={(theme: ThemePreset) => updateConfig({ theme })}
          onSelectLayout={(layoutMode: WindowLayoutMode) =>
            updateConfig({ window: { ...config.window, layoutMode } })
          }
          onRefreshAllSources={refreshAllSources}
          onOpenAdminPanel={(tab) => {
            if (tab) setAdminTab(tab as AdminTabId);
            setAdminOpen(true);
          }}
        />
      )}

      {/* Slide-Over Lateral Administration Panel */}
      <AdminDrawerPanel
        isOpen={adminOpen}
        activeTab={adminTab}
        selectedBandId={selectedBandId}
        config={config}
        onClose={() => setAdminOpen(false)}
        onSelectTab={setAdminTab}
        onSelectBandId={setSelectedBandId}
        onUpdateConfig={updateConfig}
        onUpdateBands={updateBands}
        onUpdateSources={updateSources}
        onRefreshSource={refreshSingleSource}
        onRefreshAll={refreshAllSources}
        onApplyGlobalStyleToAllBands={handleApplyGlobalStyleToAllBands}
        onResetAllBandStyles={handleResetAllBandStyles}
        onSelectProfilePreset={handleSelectProfilePreset}
        onSaveCustomProfileSnapshot={handleSaveCustomProfileSnapshot}
        onLoadCustomProfileSnapshot={handleLoadCustomProfileSnapshot}
        onDeleteCustomProfileSnapshot={handleDeleteCustomProfileSnapshot}
        onResetFactoryDefaults={handleResetFactoryDefaults}
      />
    </div>
  );
}
