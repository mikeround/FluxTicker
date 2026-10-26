import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Bookmark,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { BandConfig, TickerItem } from '../types/ticker';
import { CATEGORY_METADATA } from '../data/defaultPresets';

interface ItemDetailModalProps {
  item: TickerItem | null;
  band: BandConfig | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (item: TickerItem) => void;
  onConfigureBand: (bandId: string) => void;
}

const FRESHNESS_DESCRIPTIONS: Record<TickerItem['freshness'], string> = {
  DIRECTO: 'Datos en directo — Recibidos en tiempo real del proveedor autorizado.',
  DIFERIDO: 'Datos diferidos — Cotización o boletín con retardo estándar del proveedor.',
  ALMACENADO: 'Datos almacenados en caché — Sirviendo copia local por optimización o modo sin conexión.',
  DEMOSTRACION: 'Datos de demostración — Muestra identificativa inicial.',
  NO_DISPONIBLE: 'No disponible (N/D) — Sensor protegido en navegador o fuente inaccesible.',
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  band,
  isFavorite,
  onClose,
  onToggleFavorite,
  onConfigureBand,
}) => {
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  if (!item || !band) return null;

  const meta = CATEGORY_METADATA[item.category];

  const handleCopy = async () => {
    const fullText = [
      item.title,
      item.value ? `Valor: ${item.value}` : '',
      item.delta ? `Variación: ${item.delta}` : '',
      item.subtitle ? item.subtitle : '',
      `Fuente: ${item.sourceName}`,
      item.sourceUrl ? `Enlace: ${item.sourceUrl}` : '',
    ]
      .filter(Boolean)
      .join(' — ');

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerateAiSummary = async () => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          subtitle: item.subtitle,
          sourceName: item.sourceName,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setAiSummary(data.summary);
      }
    } catch {
      setAiSummary('No fue posible conectar con el servicio de síntesis en este momento.');
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded-lg p-6 text-slate-100 shadow-2xl select-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Metadata Line (Unboxed text with · separators) */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span style={{ color: meta.darkAccent }} className="font-semibold">
              {band.name}
            </span>
            <span aria-hidden="true">·</span>
            <span>{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span>{item.sourceName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle del titular"
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selectable Main Content */}
        <div className="py-5 space-y-3">
          <h2
            id="item-detail-title"
            dir={item.isRtl ? 'rtl' : 'ltr'}
            className="text-lg font-semibold leading-snug text-white select-text"
          >
            {item.title}
          </h2>

          {(item.value || item.secondaryValue || item.delta) && (
            <div className="flex flex-wrap items-baseline gap-4 pt-1 font-mono tabular-nums">
              {item.value && (
                <span className="text-2xl font-bold" style={{ color: meta.darkAccent }}>
                  {item.value}
                </span>
              )}
              {item.delta && (
                <span
                  className={`text-sm font-medium ${
                    typeof item.deltaPercent === 'number' && item.deltaPercent > 0
                      ? 'text-emerald-400'
                      : typeof item.deltaPercent === 'number' && item.deltaPercent < 0
                      ? 'text-red-400'
                      : 'text-slate-300'
                  }`}
                >
                  {item.delta}{' '}
                  {typeof item.deltaPercent === 'number'
                    ? `(${item.deltaPercent >= 0 ? '+' : ''}${item.deltaPercent.toFixed(2)}%)`
                    : ''}
                </span>
              )}
              {item.secondaryValue && (
                <span className="text-sm text-slate-300">{item.secondaryValue}</span>
              )}
            </div>
          )}

          {item.subtitle && (
            <p
              dir={item.isRtl ? 'rtl' : 'ltr'}
              className="text-sm text-slate-300 leading-relaxed select-text"
            >
              {item.subtitle}
            </p>
          )}

          {/* Provenance & Freshness Transparency */}
          <div className="pt-3 border-t border-slate-900 text-xs text-slate-400 space-y-1 font-mono tabular-nums">
            <div>
              Estado del dato: <span className="text-slate-200">{FRESHNESS_DESCRIPTIONS[item.freshness]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.publishedAt && (
                <>
                  <span>
                    Publicado:{' '}
                    {new Date(item.publishedAt).toLocaleString('es-ES', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>
                Actualizado:{' '}
                {new Date(item.updatedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Clearly Differentiated AI Summary Section */}
          {aiSummary && (
            <div className="mt-4 p-3.5 rounded bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-sky-400">
                Resumen generado mediante IA (Diferenciado de la fuente original)
              </div>
              <p className="text-xs text-slate-200 leading-relaxed select-text">{aiSummary}</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado al portapapeles' : 'Copiar contenido'}
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-sky-400 text-sky-400' : ''}`} />
              {isFavorite ? 'Guardado en Favoritos' : 'Guardar en Favoritos'}
            </button>

            {!aiSummary && (
              <button
                type="button"
                onClick={handleGenerateAiSummary}
                disabled={loadingAi}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                {loadingAi ? 'Sintetizando...' : 'Resumen IA'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onConfigureBand(band.id);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configurar banda
            </button>

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <span>Abrir artículo original</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
