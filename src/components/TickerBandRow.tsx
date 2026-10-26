import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Settings2,
  AlertTriangle,
  Bookmark,
} from 'lucide-react';
import {
  BandConfig,
  BandStyleConfig,
  GlobalMotionConfig,
  ThemePreset,
  TickerItem,
} from '../types/ticker';
import { CATEGORY_METADATA } from '../data/defaultPresets';

interface TickerBandRowProps {
  band: BandConfig;
  items: TickerItem[];
  theme: ThemePreset;
  monochromeColor: string;
  customTheme: {
    bg: string;
    text: string;
    accent: string;
    border: string;
  };
  globalOverrides: Partial<BandStyleConfig>;
  motionConfig: GlobalMotionConfig;
  isFavorite: (itemId: string) => boolean;
  onSelectItem: (item: TickerItem, band: BandConfig) => void;
  onToggleBandPause: (bandId: string) => void;
  onOpenBandSettings: (bandId: string) => void;
}

const FRESHNESS_LABELS: Record<TickerItem['freshness'], string> = {
  DIRECTO: 'DIRECTO',
  DIFERIDO: 'DIFERIDO',
  ALMACENADO: 'CACHÉ',
  DEMOSTRACION: 'DEMO',
  NO_DISPONIBLE: 'N/D',
};

export const TickerBandRow: React.FC<TickerBandRowProps> = ({
  band,
  items,
  theme,
  monochromeColor,
  customTheme,
  globalOverrides,
  motionConfig,
  isFavorite,
  onSelectItem,
  onToggleBandPause,
  onOpenBandSettings,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackGroupRef = useRef<HTMLDivElement | null>(null);
  const singleTrackRef = useRef<HTMLDivElement | null>(null);

  const offsetPxRef = useRef<number>(0);
  const singleWidthRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const isHoveredRef = useRef<boolean>(false);

  const [isBandHovered, setIsBandHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Merge per-band styles with optional global overrides
  const style: BandStyleConfig = {
    ...band.style,
    ...globalOverrides,
  };

  const meta = CATEGORY_METADATA[band.category];

  // Resolve effective colors based on active ThemePreset
  let resolvedBg = style.bgColor;
  let resolvedText = style.textColor;
  let resolvedAccent = style.accentColor;
  let resolvedBorder = style.borderColor;

  if (theme === 'LIGHT') {
    resolvedBg = meta.lightBg;
    resolvedText = '#0f172a';
    resolvedAccent = meta.lightAccent;
    resolvedBorder = '#e2e8f0';
  } else if (theme === 'MONOCHROME') {
    resolvedBg = '#070a0f';
    resolvedText = monochromeColor;
    resolvedAccent = monochromeColor;
    resolvedBorder = `${monochromeColor}33`;
  } else if (theme === 'CUSTOM') {
    resolvedBg = customTheme.bg || style.bgColor;
    resolvedText = customTheme.text || style.textColor;
    resolvedAccent = customTheme.accent || style.accentColor;
    resolvedBorder = customTheme.border || style.borderColor;
  }

  // Detect OS prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Measure single track width via ResizeObserver without resetting scroll offset
  useEffect(() => {
    const el = singleTrackRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.scrollWidth;
      if (w > 0) {
        singleWidthRef.current = w;
        if (offsetPxRef.current >= w) {
          offsetPxRef.current = offsetPxRef.current % w;
        }
      }
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, style.fontSize, style.fontFamily, style.itemSeparatorSpacing, style.letterSpacing]);

  const effectiveStatic =
    style.staticMode ||
    motionConfig.defaultDirection === 'STATIC' ||
    (motionConfig.respectReducedMotion && prefersReducedMotion);

  const effectivePaused =
    band.paused ||
    motionConfig.globalPaused ||
    effectiveStatic;

  const effectiveSpeed = Math.max(5, style.speedPxPerSec * motionConfig.speedMultiplier);

  // Store animation parameters in ref so RAF loop never restarts or jumps on prop changes
  const animParamsRef = useRef({
    paused: effectivePaused,
    pauseOnHover: style.pauseOnHover,
    speed: effectiveSpeed,
    pauseOnBlur: motionConfig.pauseAllOnWindowBlur,
  });

  useEffect(() => {
    animParamsRef.current = {
      paused: effectivePaused,
      pauseOnHover: style.pauseOnHover,
      speed: effectiveSpeed,
      pauseOnBlur: motionConfig.pauseAllOnWindowBlur,
    };
  }, [effectivePaused, style.pauseOnHover, effectiveSpeed, motionConfig.pauseAllOnWindowBlur]);

  // Continuous compositor-accelerated right-to-left scrolling loop
  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const dtSec = Math.min((now - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = now;

      const params = animParamsRef.current;
      const isDocHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const shouldFreeze =
        params.paused ||
        (params.pauseOnHover && isHoveredRef.current) ||
        (params.pauseOnBlur && isDocHidden);

      if (!shouldFreeze && singleWidthRef.current > 0) {
        offsetPxRef.current += params.speed * dtSec;
        if (offsetPxRef.current >= singleWidthRef.current) {
          offsetPxRef.current -= singleWidthRef.current;
        }
        if (trackGroupRef.current) {
          trackGroupRef.current.style.transform = `translate3d(-${offsetPxRef.current.toFixed(2)}px, 0, 0)`;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleManualStep = (deltaPx: number) => {
    const w = singleWidthRef.current || 800;
    offsetPxRef.current = (offsetPxRef.current + deltaPx + w) % w;
    if (trackGroupRef.current) {
      trackGroupRef.current.style.transform = `translate3d(-${offsetPxRef.current.toFixed(2)}px, 0, 0)`;
    }
  };

  const verticalAlignClass =
    style.verticalAlign === 'top'
      ? 'items-start'
      : style.verticalAlign === 'bottom'
      ? 'items-end'
      : 'items-center';

  // Ensure enough repetitions to fill ultra-wide 4K screens seamlessly
  const safeItems: TickerItem[] =
    items.length > 0
      ? items
      : [
          {
            id: `empty-${band.id}`,
            bandId: band.id,
            category: band.category,
            title: 'Sin titulares que coincidan con los filtros activos en esta banda',
            sourceName: band.name,
            updatedAt: new Date().toISOString(),
            freshness: 'NO_DISPONIBLE',
            priority: 1,
          },
        ];

  const repeatMultiplier = safeItems.length < 4 ? 4 : safeItems.length < 8 ? 2 : 1;
  const repeatedItems: TickerItem[] = [];
  for (let r = 0; r < repeatMultiplier; r++) {
    safeItems.forEach((it, idx) => {
      repeatedItems.push({ ...it, id: `${it.id}__rep${r}_${idx}` });
    });
  }

  const renderTrackItems = (keyPrefix: string) =>
    repeatedItems.map((item, idx) => {
      const baseId = item.id.split('__rep')[0];
      const fav = isFavorite(baseId);

      // Market delta color + explicit symbol (+/-) so state is never conveyed by hue alone
      const isPositive = typeof item.deltaPercent === 'number' && item.deltaPercent > 0;
      const isNegative = typeof item.deltaPercent === 'number' && item.deltaPercent < 0;
      const deltaColor =
        theme === 'MONOCHROME'
          ? resolvedText
          : isPositive
          ? theme === 'LIGHT'
            ? '#047857'
            : '#34d399'
          : isNegative
          ? theme === 'LIGHT'
            ? '#b91c1c'
            : '#f87171'
          : resolvedText;

      const isSensorAlert = item.sensorStatus === 'ALERT' || item.alertTriggered;
      const isSensorWarn = item.sensorStatus === 'WARNING';

      return (
        <React.Fragment key={`${keyPrefix}-${item.id}-${idx}`}>
          <button
            type="button"
            onClick={() => onSelectItem({ ...item, id: baseId }, band)}
            dir={item.isRtl ? 'rtl' : 'ltr'}
            style={{
              unicodeBidi: 'isolate',
              fontSize: `${style.fontSize}px`,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              letterSpacing: `${style.letterSpacing}em`,
              color: resolvedText,
            }}
            className="group/item inline-flex items-baseline gap-2 whitespace-nowrap shrink-0 text-left focus:outline-none focus-visible:underline hover:opacity-90 transition-opacity cursor-pointer"
            aria-label={`${band.name}: ${item.title} ${item.value || ''}`}
          >
            {/* Alert or Warning discrete indicator */}
            {style.showIcons && isSensorAlert && (
              <AlertTriangle
                className="w-3.5 h-3.5 shrink-0 self-center text-red-400"
                aria-label="Alerta activa"
              />
            )}
            {style.showIcons && fav && (
              <Bookmark
                className="w-3 h-3 shrink-0 self-center fill-current"
                style={{ color: resolvedAccent }}
                aria-label="Guardado en favoritos"
              />
            )}

            {/* Primary Title / Label */}
            <span
              className={
                item.category === 'RELOJ_MUNDIAL' ||
                item.category === 'MERCADOS' ||
                item.category === 'HARDWARE' ||
                item.category === 'METEOROLOGIA'
                  ? 'font-semibold tracking-tight'
                  : 'font-medium group-hover/item:underline decoration-1 underline-offset-4'
              }
              style={{
                color: isSensorAlert
                  ? '#f87171'
                  : isSensorWarn
                  ? '#fbbf24'
                  : resolvedText,
              }}
            >
              {item.title}
            </span>

            {/* Numeric or Primary Metric Value (Tabular Numerals) */}
            {item.value && (
              <span
                className="font-mono tabular-nums font-semibold"
                style={{
                  color:
                    item.value === 'N/D'
                      ? theme === 'LIGHT'
                        ? '#64748b'
                        : '#94a3b8'
                      : resolvedAccent,
                }}
              >
                {item.value}
              </span>
            )}

            {/* Delta & Percentage for Markets */}
            {(item.delta || typeof item.deltaPercent === 'number') && (
              <span
                className="font-mono tabular-nums text-[0.88em] font-medium"
                style={{ color: deltaColor }}
              >
                {isPositive ? '▲ ' : isNegative ? '▼ ' : ''}
                {item.delta ? `${item.delta} ` : ''}
                {typeof item.deltaPercent === 'number'
                  ? `(${item.deltaPercent >= 0 ? '+' : ''}${item.deltaPercent.toFixed(2)}%)`
                  : ''}
              </span>
            )}

            {/* Secondary value (e.g. UTC offset, CPU Temp, Weather condition) */}
            {item.secondaryValue && (
              <span className="font-mono tabular-nums text-[0.86em] opacity-80">
                {item.secondaryValue}
              </span>
            )}

            {/* Subtitle / Brief context for agenda or weather */}
            {item.subtitle &&
              (item.category === 'METEOROLOGIA' ||
                item.category === 'AGENDA' ||
                item.category === 'RELOJ_MUNDIAL') && (
                <span className="text-[0.85em] opacity-70">{item.subtitle}</span>
              )}

            {/* Quiet unboxed source & timestamp metadata (Zero-Pill discipline) */}
            <span className="text-[0.76em] font-mono tabular-nums opacity-55">
              {item.sourceName}
              {item.publishedAt
                ? ` · ${new Date(item.publishedAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
              {item.freshness !== 'DIRECTO' ? ` · ${FRESHNESS_LABELS[item.freshness]}` : ''}
            </span>
          </button>

          {/* Configurable Typographic Separator */}
          <span
            aria-hidden="true"
            style={{
              paddingLeft: `${style.itemSeparatorSpacing / 2}px`,
              paddingRight: `${style.itemSeparatorSpacing / 2}px`,
              color: resolvedAccent,
              opacity: 0.45,
              fontSize: `${style.fontSize}px`,
            }}
            className="select-none shrink-0 font-mono"
          >
            {style.itemSeparatorSymbol}
          </span>
        </React.Fragment>
      );
    });

  return (
    <section
      ref={containerRef}
      aria-label={`Banda ${band.name}`}
      data-testid={`ticker-band-${band.id}`}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        setIsBandHovered(true);
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        setIsBandHovered(false);
      }}
      style={{
        height: `${style.bandHeight}px`,
        marginTop: `${style.marginY}px`,
        marginBottom: `${style.bandGap}px`,
        paddingTop: `${style.paddingY}px`,
        paddingBottom: `${style.paddingY}px`,
        paddingLeft: `${style.indentLeft}px`,
        paddingRight: `${style.indentRight}px`,
        backgroundColor: resolvedBg,
        borderBottom: `1px solid ${resolvedBorder}`,
        opacity: style.opacity,
      }}
      className={`relative w-full overflow-hidden flex ${verticalAlignClass} select-none transition-colors duration-150`}
    >
      {/* Left Category / Band Label Anchor with fixed width and overlay hover controls */}
      <div
        style={{
          backgroundColor: resolvedBg,
          borderRight: `1px solid ${resolvedBorder}`,
          paddingLeft: `${Math.max(12, style.paddingX)}px`,
          paddingRight: `${Math.max(10, style.paddingX)}px`,
        }}
        className="relative z-10 h-full w-44 min-w-[176px] max-w-[176px] flex items-center justify-between shrink-0"
      >
        <span
          style={{
            color: resolvedAccent,
            fontSize: `${Math.max(10, Math.min(13, style.fontSize * 0.82))}px`,
          }}
          className="font-mono font-semibold tracking-wider uppercase truncate"
        >
          {band.name}
        </span>

        {/* Discrete per-band quick controls shown as overlay inside fixed header on band hover or when paused */}
        <div
          style={{ backgroundColor: resolvedBg }}
          className={`absolute right-1.5 inset-y-0 flex items-center gap-0.5 pl-2 transition-opacity duration-150 ${
            isBandHovered || band.paused
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto'
          }`}
        >
          <button
            type="button"
            onClick={() => handleManualStep(-220)}
            title="Retroceder titulares"
            aria-label={`Retroceder banda ${band.name}`}
            style={{ color: resolvedText }}
            className="p-1 rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleBandPause(band.id)}
            title={band.paused ? 'Reanudar esta banda' : 'Pausar esta banda'}
            aria-label={band.paused ? `Reanudar banda ${band.name}` : `Pausar banda ${band.name}`}
            style={{ color: band.paused ? resolvedAccent : resolvedText }}
            className="p-1 rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          >
            {band.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => handleManualStep(220)}
            title="Avanzar hacia otros titulares"
            aria-label={`Avanzar banda ${band.name}`}
            style={{ color: resolvedText }}
            className="p-1 rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenBandSettings(band.id)}
            title="Configurar parámetros de esta banda"
            aria-label={`Configurar banda ${band.name}`}
            style={{ color: resolvedText }}
            className="p-1 rounded hover:bg-white/10 focus-visible:outline focus-visible:outline-1 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 opacity-75" />
          </button>
        </div>
      </div>

      {/* Continuous Right-to-Left Scrolling Viewport */}
      <div className="relative flex-1 h-full overflow-hidden flex items-center">
        <div
          ref={trackGroupRef}
          className="flex items-center whitespace-nowrap will-change-transform"
          style={{
            paddingLeft: `${style.paddingX}px`,
          }}
        >
          {/* Track Copy A (measured by ResizeObserver) */}
          <div ref={singleTrackRef} className="inline-flex items-center whitespace-nowrap shrink-0">
            {renderTrackItems('trackA')}
          </div>
          {/* Track Copy B (seamless loop continuation) */}
          <div aria-hidden="true" className="inline-flex items-center whitespace-nowrap shrink-0">
            {renderTrackItems('trackB')}
          </div>
        </div>
      </div>
    </section>
  );
};
