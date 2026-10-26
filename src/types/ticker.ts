export type BandCategory =
  | 'HARDWARE'
  | 'RELOJ_MUNDIAL'
  | 'MERCADOS'
  | 'ECONOMIA'
  | 'POLITICA'
  | 'GEOPOLITICA'
  | 'ACTUALIDAD'
  | 'LOCAL'
  | 'CIENCIA'
  | 'TECNOLOGIA'
  | 'METEOROLOGIA'
  | 'AGENDA'
  | 'PERSONALIZADA';

export type DataFreshnessStatus =
  | 'DIRECTO'
  | 'DIFERIDO'
  | 'ALMACENADO'
  | 'DEMOSTRACION'
  | 'NO_DISPONIBLE';

export type FeedFormat =
  | 'RSS'
  | 'ATOM'
  | 'JSON_FEED'
  | 'API_JSON'
  | 'WEBSOCKET'
  | 'SSE'
  | 'LOCAL_AGENT';

export type SourceTrustLevel = 'AUTHORIZED' | 'PRIORITY' | 'BLOCKED';

export type SortOrderMode = 'CHRONOLOGICAL' | 'PRIORITY';

export type ThemePreset = 'DARK' | 'LIGHT' | 'MONOCHROME' | 'CUSTOM';

export type WindowLayoutMode =
  | 'FULLSCREEN'
  | 'WINDOWED'
  | 'TOP_BAR'
  | 'BOTTOM_BAR'
  | 'SIDE_COLUMN'
  | 'COMPACT_FLOAT'
  | 'COMPACT_BAR'
  | 'VERTICAL_SCREEN'
  | 'KIOSK';

export type ProfilePresetId =
  | 'TRABAJO'
  | 'MERCADOS'
  | 'NOTICIAS'
  | 'MONITOR_SECUNDARIO'
  | 'TELEVISOR'
  | 'PERSONALIZADO';

export interface TickerItem {
  id: string;
  bandId: string;
  category: BandCategory;
  title: string;
  subtitle?: string;
  value?: string;
  secondaryValue?: string;
  delta?: string;
  deltaPercent?: number;
  unit?: string;
  sourceName: string;
  sourceId?: string;
  sourceUrl?: string;
  publishedAt?: string;
  updatedAt: string;
  freshness: DataFreshnessStatus;
  isRtl?: boolean;
  priority: number;
  language?: string;
  country?: string;
  region?: string;
  tags?: string[];
  alertTriggered?: boolean;
  sensorStatus?: 'NOMINAL' | 'WARNING' | 'ALERT' | 'ND';
  summaryAi?: string;
}

export interface BandStyleConfig {
  fontSize: number; // px (11 - 42)
  fontFamily: string;
  fontWeight: number; // 400, 500, 600, 700
  letterSpacing: number; // em (-0.03 to 0.15)
  indentLeft: number; // px
  indentRight: number; // px
  paddingY: number; // px
  paddingX: number; // px
  marginY: number; // px
  bandHeight: number; // px (28 - 96)
  bandGap: number; // px (0 - 24)
  verticalAlign: 'top' | 'center' | 'bottom';
  itemSeparatorSpacing: number; // px (16 - 96)
  itemSeparatorSymbol: '·' | '/' | '|' | '—' | '•';
  speedPxPerSec: number; // px/s (10 - 250)
  textColor: string;
  bgColor: string;
  accentColor: string;
  borderColor: string;
  opacity: number; // 0.2 - 1.0
  showIcons: boolean;
  staticMode: boolean;
  pauseOnHover: boolean;
}

export interface WorldCityConfig {
  id: string;
  name: string;
  country: string;
  timeZone: string;
  showDate: boolean;
  showSeconds: boolean;
  showOffset: boolean;
}

export interface MarketSymbolConfig {
  symbol: string;
  name: string;
  assetClass: 'INDEX' | 'STOCK' | 'ETF' | 'FOREX' | 'COMMODITY' | 'CRYPTO';
  currency: string;
}

export interface HardwareThresholdConfig {
  cpuTempWarn: number;
  cpuTempAlert: number;
  gpuTempWarn: number;
  gpuTempAlert: number;
  cpuUsageWarn: number;
  ramUsageWarn: number;
  diskUsageWarn: number;
}

export interface WeatherCityConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface AgendaEventConfig {
  id: string;
  title: string;
  time: string;
  date: string;
  location?: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  completed?: boolean;
}

export interface CustomTickerEntry {
  id: string;
  label: string;
  value: string;
  unit?: string;
  url?: string;
}

export interface BandConfig {
  id: string;
  name: string;
  category: BandCategory;
  enabled: boolean;
  hidden: boolean;
  paused: boolean;
  group?: string;
  order: number;
  compactSelected?: boolean;
  style: BandStyleConfig;
  sourceIds: string[];
  filterKeywords: string[];
  blockedKeywords: string[];
  languageFilter: string; // 'ALL' | 'es' | 'en' | 'fr' ...
  countryFilter: string; // 'ALL' | 'ES' | 'US' | 'GB' ...
  regionFilter: string; // 'ALL' | custom locality/region
  localRegionName?: string;
  sortOrder: SortOrderMode;
  worldCities?: WorldCityConfig[];
  marketSymbols?: MarketSymbolConfig[];
  hardwareThresholds?: HardwareThresholdConfig;
  weatherCities?: WeatherCityConfig[];
  agendaItems?: AgendaEventConfig[];
  customEntries?: CustomTickerEntry[];
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  format: FeedFormat;
  category: BandCategory;
  officialProvider: boolean;
  language: string;
  country: string;
  region?: string;
  trustLevel: SourceTrustLevel;
  refreshIntervalSec: number;
  lastUpdated?: string;
  lastStatus: DataFreshnessStatus;
  lastError?: string;
  itemCount: number;
  enabled: boolean;
  requiresAuth?: boolean;
  authHeaderName?: string;
}

export interface GlobalMotionConfig {
  globalPaused: boolean;
  speedMultiplier: number; // 0.25x to 3.0x
  respectReducedMotion: boolean;
  pauseAllOnWindowBlur: boolean;
  defaultDirection: 'RTL_SCROLL' | 'STATIC';
}

export interface WindowDisplayConfig {
  layoutMode: WindowLayoutMode;
  alwaysOnTop: boolean;
  borderless: boolean;
  autoFitScreen: boolean;
  draggableWindow: boolean;
  rememberPosition: boolean;
  targetMonitor: 'PRIMARY' | 'SECONDARY_2' | 'TV_DISPLAY' | 'ULTRAWIDE' | 'VERTICAL_PORTRAIT';
  dpiScale: number; // 0.75 to 2.0
  windowOpacity: number; // 0.3 to 1.0
  customWidthPx: number;
  customHeightPx: number;
  positionX: number;
  positionY: number;
}

export interface HardwareAgentConnectionConfig {
  enabled: boolean;
  endpointUrl: string;
  pollIntervalMs: number;
  authToken?: string;
  connected: boolean;
  lastSeen?: string;
  useWebNavigatorFallback: boolean;
}

export interface KeywordAlertRule {
  id: string;
  keyword: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  enabled: boolean;
  matchCount: number;
  lastTriggeredAt?: string;
}

export interface HistoricalLogEntry {
  id: string;
  timestamp: string;
  bandName: string;
  category: BandCategory;
  title: string;
  sourceName: string;
  freshness: DataFreshnessStatus;
}

export interface CustomProfileSnapshot {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  bands: BandConfig[];
  theme: ThemePreset;
  windowSettings: WindowDisplayConfig;
}

export interface AppConfiguration {
  version: string;
  activeProfileId: ProfilePresetId;
  theme: ThemePreset;
  monochromeColor: string;
  customThemeBg: string;
  customThemeText: string;
  customThemeAccent: string;
  customThemeBorder: string;
  globalStyleOverrides: Partial<BandStyleConfig>;
  motion: GlobalMotionConfig;
  window: WindowDisplayConfig;
  hardwareAgent: HardwareAgentConnectionConfig;
  keywordAlerts: KeywordAlertRule[];
  favorites: TickerItem[];
  historyLog: HistoricalLogEntry[];
  maxHistoryEntries: number;
  bands: BandConfig[];
  sources: FeedSource[];
  customProfiles: CustomProfileSnapshot[];
}
