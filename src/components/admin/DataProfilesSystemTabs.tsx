import React, { useEffect, useState } from 'react';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  Terminal,
  Cpu,
  Bookmark,
  History,
  Bell,
  Layers,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import {
  AppConfiguration,
  ProfilePresetId,
} from '../../types/ticker';
import { PROFILE_PRESETS } from '../../data/defaultPresets';
import { validateAppConfig } from '../../utils/tickerEngine';
import {
  downloadPersonalWindowsExe,
  downloadStandaloneHtmlFile,
} from '../../utils/standaloneClientFetcher';

interface DataTabProps {
  config: AppConfiguration;
  onUpdateConfig: (patch: Partial<AppConfiguration>) => void;
  onRefreshAll: () => void;
}

export const DataTab: React.FC<DataTabProps> = ({
  config,
  onUpdateConfig,
  onRefreshAll,
}) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [newSeverity, setNewSeverity] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');

  const handleAddKeywordAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    onUpdateConfig({
      keywordAlerts: [
        ...config.keywordAlerts,
        {
          id: `al-${Date.now()}`,
          keyword: newKeyword.trim(),
          severity: newSeverity,
          enabled: true,
          matchCount: 0,
        },
      ],
    });
    setNewKeyword('');
  };

  return (
    <div className="space-y-6">
      {/* Hardware Local Agent Configuration (Section 4) */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">
              Agente Local de Hardware Windows (LibreHardwareMonitor / WMI)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Estado: {config.hardwareAgent.connected ? 'CONECTADO' : 'MODO NAVEGADOR (Sensores protegidos: N/D)'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Conforme a la arquitectura de seguridad, la versión web no accede directamente a sensores térmicos o SMBus protegidos y muestra <strong>«N/D»</strong> sin inventar datos ficticios. Active la conexión opcional con el agente local en <code className="text-sky-300">127.0.0.1:8765</code> o ejecute el paquete de escritorio Windows (.exe) para telemetría completa.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-400 mb-1">
              Endpoint local del agente de sensores
            </label>
            <input
              type="text"
              value={config.hardwareAgent.endpointUrl}
              onChange={(e) =>
                onUpdateConfig({
                  hardwareAgent: { ...config.hardwareAgent, endpointUrl: e.target.value },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Sondeo local (ms)
            </label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={500}
              value={config.hardwareAgent.pollIntervalMs}
              onChange={(e) =>
                onUpdateConfig({
                  hardwareAgent: {
                    ...config.hardwareAgent,
                    pollIntervalMs: Math.max(1000, Number(e.target.value) || 3000),
                  },
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.hardwareAgent.enabled}
              onChange={(e) =>
                onUpdateConfig({
                  hardwareAgent: { ...config.hardwareAgent, enabled: e.target.checked },
                })
              }
              className="rounded border-slate-700 bg-slate-950 text-sky-400"
            />
            <span>Conectar con Agente Local en segundo plano</span>
          </label>

          <button
            type="button"
            onClick={onRefreshAll}
            className="px-3 py-1.5 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
          >
            Sondear proveedores ahora
          </button>
        </div>
      </div>

      {/* Section 14: Smart Keyword Alerts */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-200">
            Alertas inteligentes y silenciosas por palabras clave
          </span>
        </div>

        <form onSubmit={handleAddKeywordAlert} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Palabra o frase clave (ej. inflación, BCE, alerta)..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
          />
          <select
            value={newSeverity}
            onChange={(e) => setNewSeverity(e.target.value as 'INFO' | 'WARNING' | 'CRITICAL')}
            className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
          >
            <option value="INFO">Informativa</option>
            <option value="WARNING">Aviso destacado</option>
            <option value="CRITICAL">Prioridad alta</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir regla
          </button>
        </form>

        <div className="divide-y divide-slate-800 border border-slate-800 rounded bg-slate-950">
          {config.keywordAlerts.map((rule) => (
            <div key={rule.id} className="px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      keywordAlerts: config.keywordAlerts.map((r) =>
                        r.id === rule.id ? { ...r, enabled: e.target.checked } : r
                      ),
                    })
                  }
                  className="rounded border-slate-700 bg-slate-900 text-sky-400"
                />
                <span className="font-medium text-slate-200">"{rule.keyword}"</span>
                <span className="text-[11px] font-mono text-slate-400">
                  · {rule.severity} · Coincidencias activas: {rule.matchCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({
                    keywordAlerts: config.keywordAlerts.filter((r) => r.id !== rule.id),
                  })
                }
                className="text-slate-500 hover:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Section 14: Saved Favorites */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">
              Favoritos y noticias guardadas ({config.favorites.length})
            </span>
          </div>
          {config.favorites.length > 0 && (
            <button
              type="button"
              onClick={() => onUpdateConfig({ favorites: [] })}
              className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
            >
              Vaciar favoritos
            </button>
          )}
        </div>

        {config.favorites.length === 0 ? (
          <div className="text-xs text-slate-400 py-2">
            No hay titulares guardados todavía. Pulse sobre cualquier titular en las bandas y seleccione «Guardar en Favoritos».
          </div>
        ) : (
          <div className="divide-y divide-slate-800 border border-slate-800 rounded bg-slate-950 max-h-48 overflow-y-auto">
            {config.favorites.map((fav) => (
              <div key={fav.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-slate-200 font-medium truncate">{fav.title}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {fav.sourceName} · {fav.category}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fav.sourceUrl && (
                    <a
                      href={fav.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <span>Abrir</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        favorites: config.favorites.filter((f) => f.id !== fav.id),
                      })
                    }
                    className="text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 14: Configurable Historical Log */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-200">
              Registro histórico limitado ({config.historyLog.length} / {config.maxHistoryEntries})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-400">Límite:</label>
            <input
              type="number"
              min={20}
              max={500}
              value={config.maxHistoryEntries}
              onChange={(e) =>
                onUpdateConfig({
                  maxHistoryEntries: Math.max(20, Math.min(500, Number(e.target.value) || 150)),
                })
              }
              className="w-16 px-1.5 py-0.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
            />
          </div>
        </div>
        <div className="divide-y divide-slate-800/70 border border-slate-800 rounded bg-slate-950 max-h-40 overflow-y-auto text-[11px] font-mono">
          {config.historyLog.slice(0, 30).map((entry) => (
            <div key={entry.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-slate-300">
              <span className="truncate">
                [{new Date(entry.timestamp).toLocaleTimeString('es-ES')}] {entry.bandName}: {entry.title}
              </span>
              <span className="text-slate-500 shrink-0">{entry.freshness}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ProfilesTabProps {
  config: AppConfiguration;
  onSelectProfilePreset: (id: ProfilePresetId) => void;
  onSaveCustomProfileSnapshot: (name: string, description: string) => void;
  onLoadCustomProfileSnapshot: (snapshotId: string) => void;
  onDeleteCustomProfileSnapshot: (snapshotId: string) => void;
}

export const ProfilesTab: React.FC<ProfilesTabProps> = ({
  config,
  onSelectProfilePreset,
  onSaveCustomProfileSnapshot,
  onLoadCustomProfileSnapshot,
  onDeleteCustomProfileSnapshot,
}) => {
  const [snapName, setSnapName] = useState('');
  const [snapDesc, setSnapDesc] = useState('');

  return (
    <div className="space-y-6">
      {/* Section 10: Built-in Profiles */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div>
          <div className="text-xs font-semibold text-slate-200">
            Perfiles preconfigurados (cambio instantáneo sin reiniciar)
          </div>
          <div className="text-[11px] text-slate-400">
            Adapta bandas activas, tipografía, densidad y velocidad de inmediato.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(Object.keys(PROFILE_PRESETS) as ProfilePresetId[]).map((pid) => {
            const p = PROFILE_PRESETS[pid];
            const isActive = config.activeProfileId === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => onSelectProfilePreset(pid)}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-500/60 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{p.name}</span>
                  <span className="text-[11px] font-mono text-sky-400">
                    {p.fontSize}px · {p.bandHeight}px alto
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {p.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Saved Snapshots */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200">
            Guardar estado actual como perfil personalizado
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
            placeholder="Nombre del perfil (ej. Apertura Europea)"
            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
          />
          <input
            type="text"
            value={snapDesc}
            onChange={(e) => setSnapDesc(e.target.value)}
            placeholder="Descripción breve..."
            className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
          />
          <button
            type="button"
            onClick={() => {
              if (!snapName.trim()) return;
              onSaveCustomProfileSnapshot(snapName.trim(), snapDesc.trim() || 'Configuración guardada');
              setSnapName('');
              setSnapDesc('');
            }}
            className="px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
          >
            Guardar perfil
          </button>
        </div>

        {config.customProfiles.length > 0 && (
          <div className="divide-y divide-slate-800 border border-slate-800 rounded bg-slate-950">
            {config.customProfiles.map((cp) => (
              <div key={cp.id} className="p-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-200">{cp.name}</div>
                  <div className="text-[11px] text-slate-400">{cp.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadCustomProfileSnapshot(cp.id)}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-sky-300 cursor-pointer"
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomProfileSnapshot(cp.id)}
                    className="text-slate-500 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface SystemExportTabProps {
  config: AppConfiguration;
  onImportFullConfig: (newConfig: AppConfiguration) => void;
  onResetFactoryDefaults: () => void;
}

export const SystemExportTab: React.FC<SystemExportTabProps> = ({
  config,
  onImportFullConfig,
  onResetFactoryDefaults,
}) => {
  const [jsonInput, setJsonInput] = useState('');
  const [importStatus, setImportStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [windowsFiles, setWindowsFiles] = useState<Record<string, string> | null>(null);
  const [selectedWinFile, setSelectedWinFile] = useState<string>('src-tauri/tauri.conf.json');

  useEffect(() => {
    fetch('/api/windows-bundle')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.files) {
          setWindowsFiles(data.files);
        }
      })
      .catch(() => {});
  }, []);

  const handleExportJson = () => {
    const serialized = JSON.stringify(config, null, 2);
    const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `flux-ticker-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const validation = validateAppConfig(parsed);
      if (!validation.valid || !validation.config) {
        setImportStatus({ ok: false, msg: validation.error || 'Esquema inválido.' });
        return;
      }
      onImportFullConfig(validation.config);
      setImportStatus({ ok: true, msg: 'Configuración JSON validada y aplicada con éxito.' });
      setJsonInput('');
    } catch {
      setImportStatus({ ok: false, msg: 'El texto introducido no es un JSON válido.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Direct 1-Click Personal Windows .EXE Download with Live Configuration */}
      <div className="p-4 rounded-lg bg-slate-900/95 border border-amber-500/45 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-amber-300">
              Ejecutable Directo Windows 64-bit (Flux-Ticker-Personal.exe) — Sin licencia y para uso propio
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Genera y descarga al instante un archivo <code className="text-amber-300">.exe</code> nativo para Windows (PE32+ x86_64) que lleva incrustada <strong>exactamente la configuración actual que tiene ahora mismo en pantalla</strong> (sus bandas, colores, velocidades, fuentes, tema y perfil), además del servicio automático de sensores locales de hardware (<code className="text-amber-300">127.0.0.1:8765</code>). 100 % libre de licencias, telemetría externa o restricciones para su uso personal.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void downloadPersonalWindowsExe(config);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar Flux-Ticker-Personal.exe
          </button>
        </div>
      </div>

      {/* Standalone Single-File .HTML Download Deliverable */}
      <div className="p-4 rounded-lg bg-slate-900/95 border border-emerald-500/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-emerald-300">
              Aplicación Web Portable en Archivo Único (Flux-Ticker-Standalone.html)
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Descargue la herramienta completa empaquetada en un único archivo <code className="text-emerald-300">.html</code> autónomo (incluye motor de bandas, las 13 categorías, relojes, conexión directa a Open-Meteo, divisas BCE, criptoactivos, lector RSS, perfiles y temas). Puede abrirlo con doble clic en cualquier ordenador o televisor sin necesidad de servidor.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void downloadStandaloneHtmlFile();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-400 hover:bg-emerald-300 text-slate-950 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar Flux-Ticker-Standalone.html
          </button>
        </div>
      </div>

      {/* JSON Configuration Export / Import */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">
              Importación y exportación de configuración completa (JSON con validación de esquema)
            </div>
            <div className="text-[11px] text-slate-400">
              Guarde copias de seguridad portables o sincronice su configuración entre Windows y Web.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-400 text-slate-950 rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar JSON
            </button>
            <button
              type="button"
              onClick={onResetFactoryDefaults}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar fábrica
            </button>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-[11px] text-slate-400">
            Pegar JSON de configuración para importar:
          </label>
          <textarea
            rows={4}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='{"version": "1.0.0", "bands": [...], "sources": [...]}'
            className="w-full p-2.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
          />
          {importStatus && (
            <div
              className={`text-xs p-2 rounded ${
                importStatus.ok ? 'text-emerald-300 bg-emerald-950/40' : 'text-red-300 bg-red-950/40'
              }`}
            >
              {importStatus.msg}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleImportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Validar y aplicar JSON
            </button>
          </div>
        </div>
      </div>

      {/* Windows (.exe) Tauri 2 + Rust + Local Agent Project Deliverable (Section 12 & 16) */}
      <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-slate-200">
            Proyecto Compilable Windows (.exe) — Tauri 2 + Rust + Agente de Sensores
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Código fuente nativo incluido para empaquetar Flux Ticker como instalador <code className="text-sky-300">.exe</code> (NSIS/MSI) en Windows mediante Tauri 2 (<code className="text-sky-300">npm run tauri build</code>) o ejecutar el puente local de sensores <code className="text-sky-300">FluxHardwareAgent.ps1</code>.
        </p>

        {windowsFiles && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(windowsFiles).map((fileName) => (
                <button
                  key={fileName}
                  type="button"
                  onClick={() => setSelectedWinFile(fileName)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border cursor-pointer ${
                    selectedWinFile === fileName
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {fileName}
                </button>
              ))}
            </div>
            <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
              {windowsFiles[selectedWinFile]}
            </pre>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300">
            Guía rápida de compilación y extensión de categorías:
          </div>
          <div>
            1. <strong>Ejecución Web / Servidor:</strong> <code className="text-slate-200">npm install && npm run dev</code> (puerto 3000) o <code className="text-slate-200">npm run build && npm start</code>.
          </div>
          <div>
            2. <strong>Compilación Instalador Windows (.exe):</strong> Con Rust y Tauri CLI instalados en Windows, copie la carpeta <code className="text-slate-200">src-tauri</code> y ejecute <code className="text-slate-200">npx tauri build</code> para generar el instalador en <code className="text-slate-200">src-tauri/target/release/bundle/nsis/Flux Ticker_1.0.0_x64-setup.exe</code>.
          </div>
          <div>
            3. <strong>Pruebas automatizadas:</strong> Ejecute <code className="text-slate-200">npm test</code> para verificar el motor de desplazamiento, sanitización XSS, validación anti-SSRF, deduplicación de titulares y OPML.
          </div>
        </div>
      </div>
    </div>
  );
};
