import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Pause,
  Play,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Sliders,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import {
  BandCategory,
  BandConfig,
  BandStyleConfig,
  FeedSource,
} from '../../types/ticker';
import { CATEGORY_METADATA } from '../../data/defaultPresets';
import { getDefaultBandStyle } from '../../utils/tickerEngine';

interface BandsTabProps {
  bands: BandConfig[];
  sources: FeedSource[];
  selectedBandId: string | null;
  onSelectBandId: (id: string | null) => void;
  onUpdateBands: (bands: BandConfig[]) => void;
}

const FONT_FAMILIES = [
  { label: 'Plus Jakarta Sans (Sans Moderna)', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Public Sans (Editorial Técnica)', value: "'Public Sans', sans-serif" },
  { label: 'Outfit (Geométrica Display)', value: "'Outfit', sans-serif" },
  { label: 'Manrope (Alta Legibilidad)', value: "'Manrope', sans-serif" },
  { label: 'JetBrains Mono (Monospace Tabular)', value: "'JetBrains Mono', monospace" },
  { label: 'IBM Plex Mono (Telemetría)', value: "'IBM Plex Mono', monospace" },
  { label: 'Source Serif 4 (Prensa Clásica)', value: "'Source Serif 4', serif" },
];

const EXTRA_TIMEZONES = [
  { name: 'París', country: 'Francia', timeZone: 'Europe/Paris' },
  { name: 'Berlín', country: 'Alemania', timeZone: 'Europe/Berlin' },
  { name: 'Fráncfort', country: 'Alemania', timeZone: 'Europe/Berlin' },
  { name: 'Zúrich', country: 'Suiza', timeZone: 'Europe/Zurich' },
  { name: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires' },
  { name: 'Ciudad de México', country: 'México', timeZone: 'America/Mexico_City' },
  { name: 'Bogotá', country: 'Colombia', timeZone: 'America/Bogota' },
  { name: 'Santiago', country: 'Chile', timeZone: 'America/Santiago' },
  { name: 'São Paulo', country: 'Brasil', timeZone: 'America/Sao_Paulo' },
  { name: 'Los Ángeles', country: 'EE. UU.', timeZone: 'America/Los_Angeles' },
  { name: 'Chicago', country: 'EE. UU.', timeZone: 'America/Chicago' },
  { name: 'Singapur', country: 'Singapur', timeZone: 'Asia/Singapore' },
  { name: 'Seúl', country: 'Corea del Sur', timeZone: 'Asia/Seoul' },
  { name: 'Dubái', country: 'EAU', timeZone: 'Asia/Dubai' },
  { name: 'Sídney', country: 'Australia', timeZone: 'Australia/Sydney' },
  { name: 'Canarias', country: 'España', timeZone: 'Atlantic/Canary' },
];

export const BandsTab: React.FC<BandsTabProps> = ({
  bands,
  sources,
  selectedBandId,
  onSelectBandId,
  onUpdateBands,
}) => {
  const [newBandName, setNewBandName] = useState('');
  const [newBandCategory, setNewBandCategory] = useState<BandCategory>('ACTUALIDAD');
  const [newBandSourceId, setNewBandSourceId] = useState<string>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Sub-inputs for category-specific editors
  const [newCityPresetIdx, setNewCityPresetIdx] = useState(0);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaTime, setNewAgendaTime] = useState('14:00');

  const sortedBands = [...bands].sort((a, b) => a.order - b.order);

  const handleCreateBand = (e: React.FormEvent) => {
    e.preventDefault();
    const meta = CATEGORY_METADATA[newBandCategory];
    const cleanName = newBandName.trim() || meta.label;
    const defaultSources = newBandSourceId
      ? [newBandSourceId]
      : sources.filter((s) => s.category === newBandCategory).map((s) => s.id);

    const newBand: BandConfig = {
      id: `band-${Date.now()}`,
      name: cleanName,
      category: newBandCategory,
      enabled: true,
      hidden: false,
      paused: false,
      group: 'Personalizadas',
      order: sortedBands.length + 1,
      compactSelected: true,
      style: {
        ...getDefaultBandStyle('DARK', meta.darkAccent),
        bgColor: meta.darkBg,
        accentColor: meta.darkAccent,
      },
      sourceIds: defaultSources,
      filterKeywords: [],
      blockedKeywords: [],
      languageFilter: 'ALL',
      countryFilter: 'ALL',
      regionFilter: 'ALL',
      sortOrder: 'CHRONOLOGICAL',
      worldCities:
        newBandCategory === 'RELOJ_MUNDIAL'
          ? [
              {
                id: 'mad',
                name: 'Madrid',
                country: 'España',
                timeZone: 'Europe/Madrid',
                showDate: true,
                showSeconds: true,
                showOffset: true,
              },
            ]
          : undefined,
      customEntries:
        newBandCategory === 'PERSONALIZADA'
          ? [
              {
                id: `c-${Date.now()}`,
                label: cleanName,
                value: 'Banda activa',
                unit: 'INFO',
              },
            ]
          : undefined,
      agendaItems:
        newBandCategory === 'AGENDA'
          ? [
              {
                id: `ag-${Date.now()}`,
                title: 'Revisión programada',
                time: '12:00',
                date: 'Hoy',
                priority: 'NORMAL',
              },
            ]
          : undefined,
    };

    onUpdateBands([...bands, newBand]);
    setNewBandName('');
    onSelectBandId(newBand.id);
  };

  const updateBand = (id: string, patch: Partial<BandConfig>) => {
    onUpdateBands(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const updateBandStyle = (id: string, stylePatch: Partial<BandStyleConfig>) => {
    onUpdateBands(
      bands.map((b) =>
        b.id === id ? { ...b, style: { ...b.style, ...stylePatch } } : b
      )
    );
  };

  const handleDuplicateBand = (band: BandConfig) => {
    const copy: BandConfig = {
      ...JSON.parse(JSON.stringify(band)),
      id: `band-${Date.now()}`,
      name: `${band.name} (Copia)`,
      order: sortedBands.length + 1,
    };
    onUpdateBands([...bands, copy]);
    onSelectBandId(copy.id);
  };

  const handleDeleteBand = (id: string) => {
    const remaining = bands
      .filter((b) => b.id !== id)
      .sort((a, b) => a.order - b.order)
      .map((b, idx) => ({ ...b, order: idx + 1 }));
    onUpdateBands(remaining);
    if (selectedBandId === id) onSelectBandId(null);
  };

  const handleMoveOrder = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedBands.length) return;
    const copy = [...sortedBands];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdateBands(copy.map((b, idx) => ({ ...b, order: idx + 1 })));
  };

  const handleDropOnBand = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = sortedBands.findIndex((b) => b.id === draggedId);
    const toIdx = sortedBands.findIndex((b) => b.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const copy = [...sortedBands];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    onUpdateBands(copy.map((b, idx) => ({ ...b, order: idx + 1 })));
    setDraggedId(null);
  };

  const selectedBand = bands.find((b) => b.id === selectedBandId) || null;

  return (
    <div className="space-y-6">
      {/* Quick Add Band Form (Few steps as required by Section 15) */}
      <form
        onSubmit={handleCreateBand}
        className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3"
      >
        <div className="text-xs font-semibold text-slate-200">
          Crear nueva banda horizontal
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label
              htmlFor="new-band-category"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Categoría (13 módulos)
            </label>
            <select
              id="new-band-category"
              value={newBandCategory}
              onChange={(e) => setNewBandCategory(e.target.value as BandCategory)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {(Object.keys(CATEGORY_METADATA) as BandCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_METADATA[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-band-name"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Nombre de la banda
            </label>
            <input
              id="new-band-name"
              type="text"
              value={newBandName}
              onChange={(e) => setNewBandName(e.target.value)}
              placeholder={CATEGORY_METADATA[newBandCategory].label}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label
              htmlFor="new-band-source"
              className="block text-[11px] text-slate-400 mb-1"
            >
              Fuente inicial (opcional)
            </label>
            <select
              id="new-band-source"
              value={newBandSourceId}
              onChange={(e) => setNewBandSourceId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="">Automática según categoría</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400">
            {CATEGORY_METADATA[newBandCategory].description}
          </span>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir banda
          </button>
        </div>
      </form>

      {/* Band List with Drag-and-Drop, Toggle, Pause, Hide, Duplicate, Delete, Configure */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Bandas configuradas ({sortedBands.filter((b) => b.enabled && !b.hidden).length}{' '}
            visibles de {sortedBands.length})
          </span>
          <span>Arrastre o use las flechas para reordenar</span>
        </div>

        <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-slate-950">
          {sortedBands.map((band, idx) => {
            const isSelected = band.id === selectedBandId;
            const meta = CATEGORY_METADATA[band.category];
            return (
              <div
                key={band.id}
                draggable
                onDragStart={() => setDraggedId(band.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnBand(band.id)}
                className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'bg-slate-900' : 'hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GripVertical
                    className="w-4 h-4 text-slate-600 cursor-grab shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    type="checkbox"
                    id={`enable-${band.id}`}
                    checked={band.enabled}
                    onChange={(e) => updateBand(band.id, { enabled: e.target.checked })}
                    aria-label={`Activar banda ${band.name}`}
                    className="rounded border-slate-700 bg-slate-900 text-sky-400 focus:ring-sky-500 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: band.enabled ? band.style.accentColor : '#64748b' }}
                      >
                        {band.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        · {meta.shortCode} · {band.style.speedPxPerSec} px/s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per-band quick actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(idx, -1)}
                    disabled={idx === 0}
                    title="Subir banda"
                    aria-label={`Subir banda ${band.name}`}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOrder(idx, 1)}
                    disabled={idx === sortedBands.length - 1}
                    title="Bajar banda"
                    aria-label={`Bajar banda ${band.name}`}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBand(band.id, { paused: !band.paused })}
                    title={band.paused ? 'Reanudar desplazamiento' : 'Pausar desplazamiento'}
                    aria-label={
                      band.paused ? `Reanudar ${band.name}` : `Pausar ${band.name}`
                    }
                    className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${
                      band.paused ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {band.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateBand(band.id, { hidden: !band.hidden })}
                    title={band.hidden ? 'Mostrar banda' : 'Ocultar temporalmente'}
                    aria-label={band.hidden ? `Mostrar ${band.name}` : `Ocultar ${band.name}`}
                    className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${
                      band.hidden ? 'text-slate-600' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {band.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateBand(band)}
                    title="Duplicar banda"
                    aria-label={`Duplicar banda ${band.name}`}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectBandId(isSelected ? null : band.id)}
                    title="Configurar tipografía, dimensiones, fuentes y filtros"
                    aria-label={`Editar banda ${band.name}`}
                    className={`px-2 py-1 text-xs rounded border flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Ajustar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteBand(band.id)}
                    title="Suprimir banda"
                    aria-label={`Eliminar banda ${band.name}`}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Band Detailed Configuration Inspector (Section 6 + Section 2 + Section 3) */}
      {selectedBand && (
        <div className="p-4 rounded-lg bg-slate-900/95 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Parámetros de banda: {selectedBand.name}
              </h3>
              <p className="text-xs text-slate-400">
                Previsualización en tiempo real de tipografía, dimensiones, velocidad y filtros.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const meta = CATEGORY_METADATA[selectedBand.category];
                updateBand(selectedBand.id, {
                  style: {
                    ...getDefaultBandStyle('DARK', meta.darkAccent),
                    bgColor: meta.darkBg,
                    accentColor: meta.darkAccent,
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar originales
            </button>
          </div>

          {/* Basic Identification & Grouping */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Nombre visible
              </label>
              <input
                type="text"
                value={selectedBand.name}
                onChange={(e) => updateBand(selectedBand.id, { name: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Grupo de bandas
              </label>
              <input
                type="text"
                value={selectedBand.group || ''}
                onChange={(e) => updateBand(selectedBand.id, { group: e.target.value })}
                placeholder="Ej. Principal / Mercados"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(selectedBand.compactSelected)}
                  onChange={(e) =>
                    updateBand(selectedBand.id, { compactSelected: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-sky-400"
                />
                <span>Incluir en Modo Barra Compacta</span>
              </label>
            </div>
          </div>

          {/* Section 6: Sliders + Numeric Inputs for Typography, Indentation & Dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            {/* Velocidad px/s */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Velocidad (píxeles/seg)</span>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={selectedBand.style.speedPxPerSec}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      speedPxPerSec: Math.max(5, Math.min(300, Number(e.target.value) || 40)),
                    })
                  }
                  aria-label="Velocidad en píxeles por segundo"
                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
                />
              </div>
              <input
                type="range"
                min={5}
                max={250}
                value={selectedBand.style.speedPxPerSec}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, { speedPxPerSec: Number(e.target.value) })
                }
                className="w-full accent-sky-400"
              />
            </div>

            {/* Tamaño de letra */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Tamaño de letra (px)</span>
                <input
                  type="number"
                  min={10}
                  max={48}
                  value={selectedBand.style.fontSize}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      fontSize: Math.max(10, Math.min(48, Number(e.target.value) || 14)),
                    })
                  }
                  aria-label="Tamaño de letra en píxeles"
                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
                />
              </div>
              <input
                type="range"
                min={10}
                max={42}
                value={selectedBand.style.fontSize}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, { fontSize: Number(e.target.value) })
                }
                className="w-full accent-sky-400"
              />
            </div>

            {/* Altura de banda */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Altura de banda (px)</span>
                <input
                  type="number"
                  min={24}
                  max={110}
                  value={selectedBand.style.bandHeight}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      bandHeight: Math.max(24, Math.min(110, Number(e.target.value) || 40)),
                    })
                  }
                  aria-label="Altura de banda en píxeles"
                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
                />
              </div>
              <input
                type="range"
                min={24}
                max={96}
                value={selectedBand.style.bandHeight}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, { bandHeight: Number(e.target.value) })
                }
                className="w-full accent-sky-400"
              />
            </div>

            {/* Separación entre noticias */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Separación entre noticias (px)</span>
                <input
                  type="number"
                  min={12}
                  max={120}
                  value={selectedBand.style.itemSeparatorSpacing}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      itemSeparatorSpacing: Math.max(12, Math.min(120, Number(e.target.value) || 36)),
                    })
                  }
                  aria-label="Separación entre noticias"
                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
                />
              </div>
              <input
                type="range"
                min={12}
                max={120}
                value={selectedBand.style.itemSeparatorSpacing}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, {
                    itemSeparatorSpacing: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-400"
              />
            </div>

            {/* Sangría izquierda y derecha */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Sangría izquierda / derecha (px)</span>
                <span className="font-mono text-sky-400">
                  {selectedBand.style.indentLeft}px / {selectedBand.style.indentRight}px
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={selectedBand.style.indentLeft}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { indentLeft: Number(e.target.value) })
                  }
                  aria-label="Sangría izquierda"
                  className="w-1/2 accent-sky-400"
                />
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={selectedBand.style.indentRight}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { indentRight: Number(e.target.value) })
                  }
                  aria-label="Sangría derecha"
                  className="w-1/2 accent-sky-400"
                />
              </div>
            </div>

            {/* Separación entre bandas y margen */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Separación inferior entre bandas (px)</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={selectedBand.style.bandGap}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      bandGap: Math.max(0, Math.min(24, Number(e.target.value) || 0)),
                    })
                  }
                  aria-label="Separación entre bandas"
                  className="w-16 px-1.5 py-0.5 text-right font-mono text-xs bg-slate-950 border border-slate-800 rounded text-sky-400"
                />
              </div>
              <input
                type="range"
                min={0}
                max={24}
                value={selectedBand.style.bandGap}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, { bandGap: Number(e.target.value) })
                }
                className="w-full accent-sky-400"
              />
            </div>

            {/* Familia tipográfica y Grosor */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Familia tipográfica
              </label>
              <select
                value={selectedBand.style.fontFamily}
                onChange={(e) =>
                  updateBandStyle(selectedBand.id, { fontFamily: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Grosor (Peso)
                </label>
                <select
                  value={selectedBand.style.fontWeight}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { fontWeight: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                >
                  <option value={400}>Regular (400)</option>
                  <option value={500}>Medio (500)</option>
                  <option value={600}>Seminegrita (600)</option>
                  <option value={700}>Negrita (700)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Alineación vertical
                </label>
                <select
                  value={selectedBand.style.verticalAlign}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, {
                      verticalAlign: e.target.value as BandStyleConfig['verticalAlign'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                >
                  <option value="top">Superior</option>
                  <option value="center">Centrada</option>
                  <option value="bottom">Inferior</option>
                </select>
              </div>
            </div>

            {/* Colores propios de la banda */}
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Color de texto
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedBand.style.textColor}
                    onChange={(e) =>
                      updateBandStyle(selectedBand.id, { textColor: e.target.value })
                    }
                    className="w-7 h-7 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">
                    {selectedBand.style.textColor}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Color de fondo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedBand.style.bgColor}
                    onChange={(e) =>
                      updateBandStyle(selectedBand.id, { bgColor: e.target.value })
                    }
                    className="w-7 h-7 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">
                    {selectedBand.style.bgColor}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Color de acento / etiqueta
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedBand.style.accentColor}
                    onChange={(e) =>
                      updateBandStyle(selectedBand.id, { accentColor: e.target.value })
                    }
                    className="w-7 h-7 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">
                    {selectedBand.style.accentColor}
                  </span>
                </div>
              </div>
            </div>

            {/* Comportamiento individual */}
            <div className="sm:col-span-2 flex flex-wrap gap-4 pt-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBand.style.pauseOnHover}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { pauseOnHover: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-sky-400"
                />
                <span>Detener al situar el cursor</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBand.style.staticMode}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { staticMode: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-sky-400"
                />
                <span>Dejar banda estática (sin movimiento)</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBand.style.showIcons}
                  onChange={(e) =>
                    updateBandStyle(selectedBand.id, { showIcons: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-sky-400"
                />
                <span>Mostrar iconos discretos</span>
              </label>
            </div>
          </div>

          {/* Category-Specific Modules */}
          {selectedBand.category === 'RELOJ_MUNDIAL' && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Ciudades y Husos Horarios en esta banda
              </div>
              <div className="flex gap-2">
                <select
                  value={newCityPresetIdx}
                  onChange={(e) => setNewCityPresetIdx(Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                >
                  {EXTRA_TIMEZONES.map((c, i) => (
                    <option key={c.name} value={i}>
                      {c.name} ({c.country} — {c.timeZone})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const chosen = EXTRA_TIMEZONES[newCityPresetIdx];
                    const current = selectedBand.worldCities || [];
                    updateBand(selectedBand.id, {
                      worldCities: [
                        ...current,
                        {
                          id: `city-${Date.now()}`,
                          name: chosen.name,
                          country: chosen.country,
                          timeZone: chosen.timeZone,
                          showDate: true,
                          showSeconds: true,
                          showOffset: true,
                        },
                      ],
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
                >
                  Añadir ciudad
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(selectedBand.worldCities || []).map((c) => (
                  <div
                    key={c.id}
                    className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="truncate">{c.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateBand(selectedBand.id, {
                          worldCities: (selectedBand.worldCities || []).filter(
                            (x) => x.id !== c.id
                          ),
                        })
                      }
                      aria-label={`Quitar ${c.name}`}
                      className="text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedBand.category === 'PERSONALIZADA' && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Textos propios e indicadores de banda personalizada
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  placeholder="Etiqueta o indicador (ej. Estado Servidor)"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
                <input
                  type="text"
                  value={newCustomValue}
                  onChange={(e) => setNewCustomValue(e.target.value)}
                  placeholder="Valor o mensaje (ej. 99.9% Operativo)"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCustomLabel.trim()) return;
                    const list = selectedBand.customEntries || [];
                    updateBand(selectedBand.id, {
                      customEntries: [
                        ...list,
                        {
                          id: `ce-${Date.now()}`,
                          label: newCustomLabel.trim(),
                          value: newCustomValue.trim() || 'Activo',
                        },
                      ],
                    });
                    setNewCustomLabel('');
                    setNewCustomValue('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
                >
                  Añadir indicador
                </button>
              </div>
              <div className="space-y-1">
                {(selectedBand.customEntries || []).map((entry) => (
                  <div
                    key={entry.id}
                    className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span>
                      <strong>{entry.label}:</strong> {entry.value}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateBand(selectedBand.id, {
                          customEntries: (selectedBand.customEntries || []).filter(
                            (x) => x.id !== entry.id
                          ),
                        })
                      }
                      className="text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedBand.category === 'AGENDA' && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-200">
                Eventos, recordatorios y tareas autorizadas
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="time"
                  value={newAgendaTime}
                  onChange={(e) => setNewAgendaTime(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
                <input
                  type="text"
                  value={newAgendaTitle}
                  onChange={(e) => setNewAgendaTitle(e.target.value)}
                  placeholder="Título del evento o recordatorio..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newAgendaTitle.trim()) return;
                    const list = selectedBand.agendaItems || [];
                    updateBand(selectedBand.id, {
                      agendaItems: [
                        ...list,
                        {
                          id: `ag-${Date.now()}`,
                          title: newAgendaTitle.trim(),
                          time: newAgendaTime,
                          date: 'Hoy',
                          priority: 'NORMAL',
                        },
                      ],
                    });
                    setNewAgendaTitle('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
                >
                  Añadir evento
                </button>
              </div>
              <div className="space-y-1">
                {(selectedBand.agendaItems || []).map((ev) => (
                  <div
                    key={ev.id}
                    className="px-3 py-1.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span>
                      <strong className="font-mono text-sky-400">{ev.time}</strong> — {ev.title}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateBand(selectedBand.id, {
                          agendaItems: (selectedBand.agendaItems || []).filter(
                            (x) => x.id !== ev.id
                          ),
                        })
                      }
                      className="text-slate-500 hover:text-red-400 cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-source assignment & Filters for this band */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-200">
              Combinación de fuentes y filtros en esta banda
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded">
              {sources.map((src) => {
                const checked = selectedBand.sourceIds.includes(src.id);
                return (
                  <label
                    key={src.id}
                    className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer truncate"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedBand.sourceIds, src.id]
                          : selectedBand.sourceIds.filter((id) => id !== src.id);
                        updateBand(selectedBand.id, { sourceIds: next });
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-sky-400"
                    />
                    <span className="truncate">{src.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Filtrar por palabras clave (separadas por coma)
                </label>
                <input
                  type="text"
                  value={(selectedBand.filterKeywords || []).join(', ')}
                  onChange={(e) =>
                    updateBand(selectedBand.id, {
                      filterKeywords: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Ej. BCE, tipos, IA..."
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Excluir palabras clave
                </label>
                <input
                  type="text"
                  value={(selectedBand.blockedKeywords || []).join(', ')}
                  onChange={(e) =>
                    updateBand(selectedBand.id, {
                      blockedKeywords: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Palabras bloqueadas..."
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Orden de noticias
                </label>
                <select
                  value={selectedBand.sortOrder}
                  onChange={(e) =>
                    updateBand(selectedBand.id, {
                      sortOrder: e.target.value as BandConfig['sortOrder'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                >
                  <option value="CHRONOLOGICAL">Cronológico (más recientes primero)</option>
                  <option value="PRIORITY">Por prioridad y relevancia</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
