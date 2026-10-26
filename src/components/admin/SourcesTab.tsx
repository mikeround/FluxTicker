import React, { useState } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  BandCategory,
  FeedFormat,
  FeedSource,
  SourceTrustLevel,
} from '../../types/ticker';
import { CATEGORY_METADATA } from '../../data/defaultPresets';
import {
  generateOpml,
  parseOpml,
  validateSourceUrl,
} from '../../utils/tickerEngine';

interface SourcesTabProps {
  sources: FeedSource[];
  onUpdateSources: (sources: FeedSource[]) => void;
  onRefreshSource: (source: FeedSource) => Promise<void>;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  sources,
  onUpdateSources,
  onRefreshSource,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<FeedFormat>('RSS');
  const [category, setCategory] = useState<BandCategory>('ACTUALIDAD');
  const [language, setLanguage] = useState('es');
  const [country, setCountry] = useState('ES');
  const [trustLevel, setTrustLevel] = useState<SourceTrustLevel>('AUTHORIZED');
  const [validationMsg, setValidationMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [testingUrl, setTestingUrl] = useState(false);
  const [opmlText, setOpmlText] = useState('');
  const [showOpmlBox, setShowOpmlBox] = useState(false);

  const handleTestConnectivity = async () => {
    const check = validateSourceUrl(url, format === 'LOCAL_AGENT');
    if (!check.valid || !check.normalizedUrl) {
      setValidationMsg({ ok: false, text: check.reason || 'URL no válida.' });
      return;
    }

    setTestingUrl(true);
    setValidationMsg(null);
    try {
      const res = await fetch(
        `/api/rss?url=${encodeURIComponent(check.normalizedUrl)}&category=${category}&force=1`
      );
      const data = await res.json();
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setValidationMsg({
          ok: true,
          text: `Conexión verificada (${data.freshness}): ${data.items.length} titulares leídos correctamente.`,
        });
      } else {
        setValidationMsg({
          ok: false,
          text: data.error || 'No se pudieron extraer titulares del recurso indicado.',
        });
      }
    } catch {
      setValidationMsg({
        ok: false,
        text: 'Fallo al comprobar la fuente desde el servidor.',
      });
    } finally {
      setTestingUrl(false);
    }
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateSourceUrl(url, format === 'LOCAL_AGENT');
    if (!check.valid || !check.normalizedUrl) {
      setValidationMsg({ ok: false, text: check.reason || 'Dirección URL inválida.' });
      return;
    }
    const cleanName = name.trim() || new URL(check.normalizedUrl).hostname;
    const newSource: FeedSource = {
      id: `src-${Date.now()}`,
      name: cleanName,
      url: check.normalizedUrl,
      format,
      category,
      officialProvider: false,
      language,
      country,
      trustLevel,
      refreshIntervalSec: 300,
      lastStatus: 'DIRECTO',
      itemCount: 0,
      enabled: true,
    };

    onUpdateSources([newSource, ...sources]);
    setName('');
    setUrl('');
    setValidationMsg({
      ok: true,
      text: `Fuente "${cleanName}" añadida y validada correctamente.`,
    });
    void onRefreshSource(newSource);
  };

  const handleExportOpml = () => {
    const xml = generateOpml(sources);
    const blob = new Blob([xml], { type: 'text/x-opml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'flux-ticker-feeds.opml';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImportOpml = () => {
    const parsed = parseOpml(opmlText);
    if (parsed.length === 0) {
      setValidationMsg({
        ok: false,
        text: 'No se encontraron entradas <outline xmlUrl="..." /> válidas en el OPML.',
      });
      return;
    }
    const existingUrls = new Set(sources.map((s) => s.url));
    const added: FeedSource[] = [];
    parsed.forEach((p, idx) => {
      if (existingUrls.has(p.url)) return;
      const cat =
        p.category && p.category in CATEGORY_METADATA
          ? (p.category as BandCategory)
          : 'ACTUALIDAD';
      added.push({
        id: `src-opml-${Date.now()}-${idx}`,
        name: p.name,
        url: p.url,
        format: 'RSS',
        category: cat,
        officialProvider: false,
        language: p.language || 'es',
        country: 'ES',
        trustLevel: 'AUTHORIZED',
        refreshIntervalSec: 300,
        lastStatus: 'DIRECTO',
        itemCount: 0,
        enabled: true,
      });
    });

    onUpdateSources([...added, ...sources]);
    setShowOpmlBox(false);
    setOpmlText('');
    setValidationMsg({
      ok: true,
      text: `Importadas ${added.length} fuentes nuevas desde OPML.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Add / Validate Source Form */}
      <form
        onSubmit={handleAddSource}
        className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">
            Añadir fuente RSS 2.0, Atom, JSON Feed, API JSON, SSE o WebSocket
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOpmlBox(!showOpmlBox)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              Importar OPML
            </button>
            <button
              type="button"
              onClick={handleExportOpml}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Exportar OPML
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="source-url-input"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Dirección URL de la fuente
            </label>
            <input
              id="source-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://feeds.elpais.com/..."
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="source-name-input"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Nombre identificativo
            </label>
            <input
              id="source-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Agencia EFE / Boletín Oficial"
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Formato</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FeedFormat)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
            >
              <option value="RSS">RSS 2.0</option>
              <option value="ATOM">Atom XML</option>
              <option value="JSON_FEED">JSON Feed</option>
              <option value="API_JSON">API JSON</option>
              <option value="SSE">Server-Sent Events</option>
              <option value="WEBSOCKET">WebSocket</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BandCategory)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
            >
              {(Object.keys(CATEGORY_METADATA) as BandCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_METADATA[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Idioma / País</label>
            <div className="flex gap-1">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Idioma de la fuente"
                className="w-1/2 px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="ar">AR</option>
              </select>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                maxLength={3}
                aria-label="Código de país"
                className="w-1/2 px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Lista de control</label>
            <select
              value={trustLevel}
              onChange={(e) => setTrustLevel(e.target.value as SourceTrustLevel)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
            >
              <option value="PRIORITY">Prioritaria</option>
              <option value="AUTHORIZED">Autorizada</option>
              <option value="BLOCKED">Bloqueada</option>
            </select>
          </div>
        </div>

        {validationMsg && (
          <div
            className={`flex items-center gap-2 text-xs p-2.5 rounded border ${
              validationMsg.ok
                ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                : 'bg-red-950/50 border-red-800 text-red-300'
            }`}
          >
            {validationMsg.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{validationMsg.text}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestConnectivity}
            disabled={testingUrl}
            className="px-3 py-1.5 text-xs text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded cursor-pointer"
          >
            {testingUrl ? 'Comprobando...' : 'Comprobar conectividad'}
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar fuente
          </button>
        </div>
      </form>

      {/* OPML Import Drawer */}
      {showOpmlBox && (
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="text-xs font-semibold text-slate-200">
            Pegar contenido OPML 2.0 para importar suscripciones
          </div>
          <textarea
            rows={4}
            value={opmlText}
            onChange={(e) => setOpmlText(e.target.value)}
            placeholder='<?xml version="1.0"?><opml version="2.0"><body><outline text="RTVE" xmlUrl="https://api2.rtve.es/rss/temas_noticias.xml" /></body></opml>'
            className="w-full p-2.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOpmlBox(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImportOpml}
              className="px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
            >
              Procesar e importar OPML
            </button>
          </div>
        </div>
      )}

      {/* Registered Sources Table */}
      <div className="space-y-2">
        <div className="text-xs text-slate-400">
          Fuentes registradas ({sources.length}) — Distinción transparente de estado y caché
        </div>
        <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-slate-950">
          {sources.map((src) => (
            <div
              key={src.id}
              className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={src.enabled}
                    onChange={(e) =>
                      onUpdateSources(
                        sources.map((s) =>
                          s.id === src.id ? { ...s, enabled: e.target.checked } : s
                        )
                      )
                    }
                    aria-label={`Activar fuente ${src.name}`}
                    className="rounded border-slate-700 bg-slate-900 text-sky-400"
                  />
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {src.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    · {src.format} · {CATEGORY_METADATA[src.category].shortCode} ·{' '}
                    {src.lastStatus}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-500 truncate pl-5">
                  {src.url}
                  {src.lastUpdated
                    ? ` · Actualizado ${new Date(src.lastUpdated).toLocaleTimeString('es-ES')}`
                    : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 pl-5 sm:pl-0 shrink-0">
                <select
                  value={src.trustLevel}
                  onChange={(e) =>
                    onUpdateSources(
                      sources.map((s) =>
                        s.id === src.id
                          ? { ...s, trustLevel: e.target.value as SourceTrustLevel }
                          : s
                      )
                    )
                  }
                  aria-label={`Nivel de autorización para ${src.name}`}
                  className="px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded text-slate-300"
                >
                  <option value="PRIORITY">Prioritaria</option>
                  <option value="AUTHORIZED">Autorizada</option>
                  <option value="BLOCKED">Bloqueada</option>
                </select>

                <button
                  type="button"
                  onClick={() => onRefreshSource(src)}
                  title="Consultar fuente ahora"
                  aria-label={`Actualizar fuente ${src.name}`}
                  className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateSources(sources.filter((s) => s.id !== src.id))
                  }
                  title="Eliminar fuente"
                  aria-label={`Eliminar fuente ${src.name}`}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
