import {
  HardwareAgentConnectionConfig,
  HardwareThresholdConfig,
  TickerItem,
} from '../types/ticker';

interface LocalAgentPayload {
  cpuUsagePercent?: number | 'N/D';
  cpuTempC?: number | 'N/D';
  cpuFreqGhz?: number | 'N/D';
  gpuUsagePercent?: number | 'N/D';
  gpuTempC?: number | 'N/D';
  vramUsedGb?: number | 'N/D';
  vramTotalGb?: number | 'N/D';
  ramUsedGb?: number | 'N/D';
  ramFreeGb?: number | 'N/D';
  ramTotalGb?: number | 'N/D';
  diskUsedGb?: number | 'N/D';
  diskFreeGb?: number | 'N/D';
  diskReadMbps?: number | 'N/D';
  diskWriteMbps?: number | 'N/D';
  netDownMbps?: number | 'N/D';
  netUpMbps?: number | 'N/D';
  fanRpm?: number | 'N/D';
  powerWatts?: number | 'N/D';
}

let cachedGpuRendererName: string | null = null;

function detectWebGlRenderer(): string {
  if (cachedGpuRendererName !== null) return cachedGpuRendererName;
  if (typeof document === 'undefined') return 'N/D';
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      cachedGpuRendererName = 'N/D';
      return 'N/D';
    }
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      if (renderer && typeof renderer === 'string') {
        cachedGpuRendererName = renderer.replace(/ANGLE \((.+)\)/i, '$1').slice(0, 48);
        return cachedGpuRendererName;
      }
    }
    cachedGpuRendererName = 'WebGL Estándar';
    return cachedGpuRendererName;
  } catch {
    cachedGpuRendererName = 'N/D';
    return 'N/D';
  }
}

export async function collectHardwareItems(
  bandId: string,
  agentConfig: HardwareAgentConnectionConfig,
  thresholds?: HardwareThresholdConfig
): Promise<{ items: TickerItem[]; agentConnected: boolean }> {
  const nowIso = new Date().toISOString();
  const th: HardwareThresholdConfig = thresholds || {
    cpuTempWarn: 75,
    cpuTempAlert: 88,
    gpuTempWarn: 78,
    gpuTempAlert: 90,
    cpuUsageWarn: 85,
    ramUsageWarn: 85,
    diskUsageWarn: 90,
  };

  // 1. Try Local Windows Hardware Agent if enabled by user
  if (agentConfig.enabled && agentConfig.endpointUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const headers: Record<string, string> = {};
      if (agentConfig.authToken) {
        headers['Authorization'] = `Bearer ${agentConfig.authToken}`;
      }
      const res = await fetch(agentConfig.endpointUrl, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as LocalAgentPayload;
        const cpuTempVal = typeof data.cpuTempC === 'number' ? data.cpuTempC : null;
        const gpuTempVal = typeof data.gpuTempC === 'number' ? data.gpuTempC : null;
        const cpuLoadVal = typeof data.cpuUsagePercent === 'number' ? data.cpuUsagePercent : null;

        const items: TickerItem[] = [
          {
            id: 'hw-cpu',
            bandId,
            category: 'HARDWARE',
            title: 'CPU',
            value: cpuLoadVal !== null ? `${cpuLoadVal.toFixed(0)}%` : 'N/D',
            secondaryValue: cpuTempVal !== null ? `${cpuTempVal.toFixed(1)} °C` : 'Temp: N/D',
            subtitle:
              typeof data.cpuFreqGhz === 'number'
                ? `Frecuencia ${data.cpuFreqGhz.toFixed(2)} GHz`
                : 'Frecuencia: N/D',
            sourceName: 'Agente Local Windows',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 100,
            sensorStatus:
              cpuTempVal !== null && cpuTempVal >= th.cpuTempAlert
                ? 'ALERT'
                : (cpuTempVal !== null && cpuTempVal >= th.cpuTempWarn) ||
                  (cpuLoadVal !== null && cpuLoadVal >= th.cpuUsageWarn)
                ? 'WARNING'
                : 'NOMINAL',
            alertTriggered: cpuTempVal !== null && cpuTempVal >= th.cpuTempAlert,
          },
          {
            id: 'hw-gpu',
            bandId,
            category: 'HARDWARE',
            title: 'GPU',
            value: typeof data.gpuUsagePercent === 'number' ? `${data.gpuUsagePercent.toFixed(0)}%` : 'N/D',
            secondaryValue: gpuTempVal !== null ? `${gpuTempVal.toFixed(1)} °C` : 'Temp: N/D',
            subtitle:
              typeof data.vramUsedGb === 'number'
                ? `VRAM ${data.vramUsedGb.toFixed(1)} GB`
                : 'VRAM: N/D',
            sourceName: 'Agente Local Windows',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 95,
            sensorStatus:
              gpuTempVal !== null && gpuTempVal >= th.gpuTempAlert
                ? 'ALERT'
                : gpuTempVal !== null && gpuTempVal >= th.gpuTempWarn
                ? 'WARNING'
                : 'NOMINAL',
          },
          {
            id: 'hw-ram',
            bandId,
            category: 'HARDWARE',
            title: 'RAM Sistema',
            value:
              typeof data.ramUsedGb === 'number' && typeof data.ramTotalGb === 'number'
                ? `${data.ramUsedGb.toFixed(1)} / ${data.ramTotalGb.toFixed(1)} GB`
                : 'N/D',
            secondaryValue:
              typeof data.ramFreeGb === 'number' ? `Libre ${data.ramFreeGb.toFixed(1)} GB` : undefined,
            sourceName: 'Agente Local Windows',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 90,
            sensorStatus: 'NOMINAL',
          },
          {
            id: 'hw-disk',
            bandId,
            category: 'HARDWARE',
            title: 'Almacenamiento NVMe/SSD',
            value:
              typeof data.diskFreeGb === 'number'
                ? `Libre ${data.diskFreeGb.toFixed(1)} GB`
                : 'N/D',
            secondaryValue:
              typeof data.diskReadMbps === 'number'
                ? `L/E: ${data.diskReadMbps.toFixed(1)} / ${
                    typeof data.diskWriteMbps === 'number' ? data.diskWriteMbps.toFixed(1) : '0.0'
                  } MB/s`
                : 'Actividad L/E: N/D',
            sourceName: 'Agente Local Windows',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 85,
            sensorStatus: 'NOMINAL',
          },
          {
            id: 'hw-fans-power',
            bandId,
            category: 'HARDWARE',
            title: 'Ventiladores y Energía',
            value: typeof data.fanRpm === 'number' ? `${data.fanRpm} RPM` : 'N/D',
            secondaryValue:
              typeof data.powerWatts === 'number' ? `${data.powerWatts.toFixed(0)} W` : 'Consumo: N/D',
            sourceName: 'Agente Local Windows',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 80,
            sensorStatus: typeof data.fanRpm === 'number' ? 'NOMINAL' : 'ND',
          },
        ];

        return { items, agentConnected: true };
      }
    } catch {
      // Agent not reachable; fall through to strict Web mode with N/D for protected sensors
    }
  }

  // 2. Web Mode: Read authentic browser/OS APIs where available, and strictly report "N/D"
  // for protected hardware sensors (temperatures, fan RPMs, voltage/watts, raw CPU/GPU %)
  const cores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? `${navigator.hardwareConcurrency} hilos lógicos`
      : 'N/D';

  const navAny = typeof navigator !== 'undefined' ? (navigator as unknown as Record<string, unknown>) : {};
  const deviceMemGb = typeof navAny.deviceMemory === 'number' ? `~${navAny.deviceMemory} GB asignados` : 'N/D';

  let storageText = 'N/D';
  let storageSub = 'Cuota de almacenamiento del navegador';
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number' && typeof est.quota === 'number' && est.quota > 0) {
        const usedMb = (est.usage / (1024 * 1024)).toFixed(1);
        const quotaGb = (est.quota / (1024 * 1024 * 1024)).toFixed(1);
        storageText = `${usedMb} MB usados / ${quotaGb} GB disp.`;
        storageSub = 'API StorageManager local';
      }
    } catch {
      storageText = 'N/D';
    }
  }

  let netValue = 'En línea';
  let netSub = 'Velocidad de enlace: N/D';
  if (typeof navigator !== 'undefined') {
    const conn = navAny.connection as
      | { effectiveType?: string; downlink?: number; rtt?: number }
      | undefined;
    if (conn && typeof conn.downlink === 'number') {
      netValue = `${conn.downlink} Mbps`;
      netSub = `Latencia RTT ${conn.rtt ?? 0} ms · Tipo ${(conn.effectiveType || 'red').toUpperCase()}`;
    } else if (!navigator.onLine) {
      netValue = 'Sin conexión';
    }
  }

  const gpuName = detectWebGlRenderer();

  const webItems: TickerItem[] = [
    {
      id: 'hw-web-cpu',
      bandId,
      category: 'HARDWARE',
      title: 'CPU Uso / Temp',
      value: 'N/D',
      secondaryValue: cores,
      subtitle: 'Sensores térmicos y carga protegidos en navegador (requiere Agente Local o versión Windows .exe)',
      sourceName: 'API Sistema Web',
      updatedAt: nowIso,
      freshness: 'NO_DISPONIBLE',
      priority: 100,
      sensorStatus: 'ND',
    },
    {
      id: 'hw-web-gpu',
      bandId,
      category: 'HARDWARE',
      title: 'GPU / VRAM',
      value: 'N/D',
      secondaryValue: gpuName,
      subtitle: 'Temperatura GPU: N/D · VRAM: N/D (sensor protegido en entorno web)',
      sourceName: 'WebGL / Sistema',
      updatedAt: nowIso,
      freshness: 'NO_DISPONIBLE',
      priority: 95,
      sensorStatus: 'ND',
    },
    {
      id: 'hw-web-ram',
      bandId,
      category: 'HARDWARE',
      title: 'Memoria RAM',
      value: deviceMemGb,
      secondaryValue: 'Libre/Total exacto: N/D',
      subtitle: 'Memoria física reportada por el navegador (conectar Agente Local para telemetría completa)',
      sourceName: 'API Navigator',
      updatedAt: nowIso,
      freshness: deviceMemGb !== 'N/D' ? 'DIRECTO' : 'NO_DISPONIBLE',
      priority: 90,
      sensorStatus: deviceMemGb !== 'N/D' ? 'NOMINAL' : 'ND',
    },
    {
      id: 'hw-web-storage',
      bandId,
      category: 'HARDWARE',
      title: 'Almacenamiento Local',
      value: storageText,
      secondaryValue: 'Actividad L/E disco: N/D',
      subtitle: storageSub,
      sourceName: 'StorageManager Web',
      updatedAt: nowIso,
      freshness: storageText !== 'N/D' ? 'DIRECTO' : 'NO_DISPONIBLE',
      priority: 85,
      sensorStatus: storageText !== 'N/D' ? 'NOMINAL' : 'ND',
    },
    {
      id: 'hw-web-fans',
      bandId,
      category: 'HARDWARE',
      title: 'Ventiladores y Frecuencia',
      value: 'N/D',
      secondaryValue: 'Consumo W: N/D',
      subtitle: 'Sensores SMBus/EC inaccesibles desde navegador sin Agente Local',
      sourceName: 'Sensores Hardware',
      updatedAt: nowIso,
      freshness: 'NO_DISPONIBLE',
      priority: 80,
      sensorStatus: 'ND',
    },
    {
      id: 'hw-web-net',
      bandId,
      category: 'HARDWARE',
      title: 'Estado de Red',
      value: netValue,
      secondaryValue: netSub,
      subtitle: 'Monitor de conectividad en tiempo real',
      sourceName: 'Network Information API',
      updatedAt: nowIso,
      freshness: 'DIRECTO',
      priority: 75,
      sensorStatus: 'NOMINAL',
    },
  ];

  return { items: webItems, agentConnected: false };
}
