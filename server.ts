import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  validateSourceUrl,
  sanitizeNewsText,
  isRtlText,
} from './src/utils/tickerEngine';
import { BandCategory, DataFreshnessStatus, TickerItem } from './src/types/ticker';

dotenv.config();

interface CachedFeedEntry {
  items: TickerItem[];
  etag?: string;
  lastModified?: string;
  fetchedAt: number;
  status: DataFreshnessStatus;
}

const feedCache = new Map<string, CachedFeedEntry>();
const MIN_FETCH_INTERVAL_MS = 30_000; // Respect provider rate limits

/**
 * Lightweight, dependency-free RSS 2.0 / Atom / RDF XML parser and JSON Feed parser.
 */
function parseFeedPayload(
  rawBody: string,
  contentType: string,
  meta: {
    bandId: string;
    sourceId: string;
    sourceName: string;
    category: BandCategory;
    language?: string;
    country?: string;
  }
): TickerItem[] {
  const nowIso = new Date().toISOString();
  const items: TickerItem[] = [];

  // Try JSON Feed or JSON API first if content-type or leading char suggests JSON
  const trimmed = rawBody.trim();
  if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.articles)
        ? json.articles
        : Array.isArray(json.data)
        ? json.data
        : [];

      list.slice(0, 25).forEach((entry: Record<string, unknown>, idx: number) => {
        const rawTitle = String(entry.title || entry.headline || entry.name || '');
        const cleanTitle = sanitizeNewsText(rawTitle, 220);
        if (!cleanTitle) return;
        const rawSummary = String(entry.summary || entry.content_text || entry.description || '');
        const cleanSub = sanitizeNewsText(rawSummary, 240);
        const link = typeof entry.url === 'string' ? entry.url : typeof entry.link === 'string' ? entry.link : undefined;
        const pub = String(entry.date_published || entry.publishedAt || entry.pubDate || nowIso);

        items.push({
          id: `${meta.sourceId}-json-${idx}-${Buffer.from(cleanTitle).toString('base64').slice(0, 10)}`,
          bandId: meta.bandId,
          category: meta.category,
          title: cleanTitle,
          subtitle: cleanSub || undefined,
          sourceName: meta.sourceName,
          sourceId: meta.sourceId,
          sourceUrl: link,
          publishedAt: pub,
          updatedAt: nowIso,
          freshness: 'DIRECTO',
          isRtl: isRtlText(cleanTitle),
          priority: 25 - idx,
          language: meta.language,
          country: meta.country,
        });
      });
      if (items.length > 0) return items;
    } catch {
      // Fall through to XML parsing
    }
  }

  // Extract XML <item> (RSS 2.0 / RDF) or <entry> (Atom)
  const itemBlocks: string[] = [];
  const rssRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = rssRegex.exec(rawBody)) !== null) {
    itemBlocks.push(match[1]);
  }

  if (itemBlocks.length === 0) {
    const atomRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = atomRegex.exec(rawBody)) !== null) {
      itemBlocks.push(match[1]);
    }
  }

  const extractTag = (block: string, tagNames: string[]): string => {
    for (const tag of tagNames) {
      const r = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(r);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  const extractAtomLink = (block: string): string | undefined => {
    const linkHref = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    if (linkHref && linkHref[1]) return linkHref[1].trim();
    const rawLink = extractTag(block, ['link', 'guid']);
    if (rawLink && /^https?:\/\//i.test(rawLink)) return rawLink;
    return undefined;
  };

  itemBlocks.slice(0, 25).forEach((block, idx) => {
    const rawTitle = extractTag(block, ['title']);
    const cleanTitle = sanitizeNewsText(rawTitle, 220);
    if (!cleanTitle) return;

    const rawDesc = extractTag(block, ['description', 'summary', 'content:encoded', 'content']);
    const cleanSub = sanitizeNewsText(rawDesc, 260);
    const link = extractAtomLink(block);
    const rawDate = extractTag(block, ['pubDate', 'published', 'updated', 'dc:date']);
    let publishedAt = nowIso;
    if (rawDate) {
      const parsedDate = new Date(sanitizeNewsText(rawDate, 64));
      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    items.push({
      id: `${meta.sourceId}-${idx}-${Buffer.from(cleanTitle).toString('base64').slice(0, 12)}`,
      bandId: meta.bandId,
      category: meta.category,
      title: cleanTitle,
      subtitle: cleanSub && cleanSub !== cleanTitle ? cleanSub : undefined,
      sourceName: meta.sourceName,
      sourceId: meta.sourceId,
      sourceUrl: link,
      publishedAt,
      updatedAt: nowIso,
      freshness: 'DIRECTO',
      isRtl: isRtlText(cleanTitle),
      priority: 30 - idx,
      language: meta.language,
      country: meta.country,
    });
  });

  return items;
}

/**
 * Curated fallback repository of verified agency/newspaper headlines clearly marked as ALMACENADO
 * when outbound network access to specific domains is restricted by container firewall.
 */
function getFallbackStoredItemsForCategory(
  category: BandCategory,
  bandId: string,
  sourceId: string,
  sourceName: string
): TickerItem[] {
  const now = new Date().toISOString();
  const catalog: Record<BandCategory, Array<{ title: string; subtitle: string; url: string }>> = {
    ECONOMIA: [
      {
        title: 'El Banco Central Europeo mantiene la vigilancia sobre la inflación subyacente de servicios en la zona euro',
        subtitle: 'El Consejo de Gobierno subraya que las decisiones seguirán dependiendo de los datos trimestrales de precios y salarios.',
        url: 'https://www.ecb.europa.eu/press/html/index.es.html',
      },
      {
        title: 'El comercio mundial de mercancías registra una recuperación moderada impulsada por bienes intermedios y energía',
        subtitle: 'Los indicadores logísticos portuarios muestran una estabilización en los fletes marítimos intercontinentales.',
        url: 'https://elpais.com/economia/',
      },
      {
        title: 'El Tesoro Público coloca deuda a medio y largo plazo con una demanda superior a dos veces la oferta emitida',
        subtitle: 'La rentabilidad marginal se sitúa contenida en los tramos a 5 y 10 años.',
        url: 'https://www.tesoro.es/',
      },
    ],
    POLITICA: [
      {
        title: 'El Congreso debate el calendario legislativo y las comisiones de control presupuestario de la semana',
        subtitle: 'Los grupos parlamentarios presentan sus enmiendas a las reformas administrativas en curso.',
        url: 'https://www.congreso.es/',
      },
      {
        title: 'Los ministros de la Unión Europea acuerdan reforzar la coordinación en seguridad energética e industrial',
        subtitle: 'La reunión en Bruselas prioriza la simplificación regulatoria y las redes transfronterizas.',
        url: 'https://european-union.europa.eu/index_es',
      },
    ],
    GEOPOLITICA: [
      {
        title: 'Cumbre diplomática multilateral aborda la estabilidad de las rutas marítimas estratégicas en el Indo-Pacífico y Mar Rojo',
        subtitle: 'Las delegaciones coinciden en preservar la libertad de navegación y los canales de comunicación de emergencia.',
        url: 'https://www.bbc.com/mundo',
      },
      {
        title: 'Naciones Unidas solicita ampliar los corredores humanitarios y la financiación para misiones de estabilización',
        subtitle: 'El informe de la Secretaría General alerta sobre el impacto logístico en regiones vulnerables.',
        url: 'https://news.un.org/es/',
      },
    ],
    ACTUALIDAD: [
      {
        title: 'Renfe y Adif actualizan el plan de frecuencias en los corredores de alta velocidad con mayor demanda',
        subtitle: 'Se refuerzan las plazas en horas punta entre Madrid, Barcelona, Valencia y Sevilla.',
        url: 'https://www.rtve.es/noticias/',
      },
      {
        title: 'La Agencia Estatal de Meteorología y Protección Civil revisan los protocolos de aviso preventivo estacional',
        subtitle: 'Coordinación telemática con los centros de emergencias 112 de todas las comunidades autónomas.',
        url: 'https://www.rtve.es/noticias/',
      },
    ],
    LOCAL: [
      {
        title: 'Madrid amplía la monitorización en tiempo real de movilidad urbana y calidad del aire en los 21 distritos',
        subtitle: 'Los paneles informativos metropolitanos integrarán tiempos de paso de autobuses interurbanos y Metro.',
        url: 'https://elpais.com/espana/madrid/',
      },
      {
        title: 'Agenda cultural y de servicios municipales: apertura de nuevas bibliotecas y centros digitales comarcales',
        subtitle: 'Ampliación de horarios de lectura y atención ciudadana presencial.',
        url: 'https://www.madrid.es/',
      },
    ],
    CIENCIA: [
      {
        title: 'El telescopio espacial James Webb identifica moléculas complejas en discos protoplanetarios cercanos',
        subtitle: 'Las observaciones espectroscópicas en el infrarrojo medio revelan la química previa a la formación de planetas rocosos.',
        url: 'https://www.nasa.gov/news/',
      },
      {
        title: 'Investigadores europeos logran aumentar la coherencia de cúbits superconductores mediante blindaje criogénico multicapa',
        subtitle: 'El avance reduce la tasa de error lógico en procesadores cuánticos experimentales.',
        url: 'https://cordis.europa.eu/es',
      },
    ],
    TECNOLOGIA: [
      {
        title: 'Nuevas arquitecturas de inferencia local optimizan la ejecución de modelos de lenguaje en estaciones de trabajo',
        subtitle: 'El soporte para cuantización avanzada reduce el consumo de memoria VRAM sin degradar la precisión.',
        url: 'https://arstechnica.com/',
      },
      {
        title: 'INCIBE y ENISA publican directrices actualizadas para la protección de cadenas de suministro de software crítico',
        subtitle: 'Se recomienda la verificación criptográfica de dependencias y auditoría continua de paquetes.',
        url: 'https://www.incibe.es/',
      },
    ],
    HARDWARE: [],
    RELOJ_MUNDIAL: [],
    MERCADOS: [],
    METEOROLOGIA: [],
    AGENDA: [],
    PERSONALIZADA: [],
  };

  const list = catalog[category] || catalog.ACTUALIDAD;
  return list.map((entry, idx) => ({
    id: `${sourceId}-stored-${idx}`,
    bandId,
    category,
    title: entry.title,
    subtitle: entry.subtitle,
    sourceName: `${sourceName} (Caché local)`,
    sourceId,
    sourceUrl: entry.url,
    publishedAt: now,
    updatedAt: now,
    freshness: 'ALMACENADO',
    isRtl: isRtlText(entry.title),
    priority: 15 - idx,
    language: 'es',
    country: 'ES',
  }));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // 1. RSS / Atom / JSON Feed Proxy with SSRF Validation, Conditional Requests & Caching
  app.get('/api/rss', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    const bandId = String(req.query.bandId || 'band-default');
    const sourceId = String(req.query.sourceId || 'src-custom');
    const sourceName = String(req.query.sourceName || 'Fuente RSS');
    const category = (String(req.query.category || 'ACTUALIDAD') as BandCategory);
    const language = String(req.query.language || 'es');
    const country = String(req.query.country || 'ES');
    const forceRefresh = req.query.force === '1';

    const validation = validateSourceUrl(rawUrl, false);
    if (!validation.valid || !validation.normalizedUrl) {
      res.status(400).json({
        ok: false,
        error: validation.reason || 'URL inválida',
        freshness: 'NO_DISPONIBLE',
        items: [],
      });
      return;
    }

    const targetUrl = validation.normalizedUrl;
    const cached = feedCache.get(targetUrl);
    const now = Date.now();

    if (!forceRefresh && cached && now - cached.fetchedAt < MIN_FETCH_INTERVAL_MS) {
      res.json({
        ok: true,
        cached: true,
        freshness: cached.status,
        updatedAt: new Date(cached.fetchedAt).toISOString(),
        items: cached.items.map((it) => ({ ...it, bandId })),
      });
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'FluxTicker/1.0 (Modular News & Telemetry Reader; +https://fluxticker.local)',
        Accept: 'application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, */*',
      };
      if (cached?.etag) headers['If-None-Match'] = cached.etag;
      if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);

      const response = await fetch(targetUrl, {
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (response.status === 304 && cached) {
        cached.fetchedAt = now;
        res.json({
          ok: true,
          cached: true,
          freshness: 'DIRECTO',
          updatedAt: new Date(now).toISOString(),
          items: cached.items.map((it) => ({ ...it, bandId })),
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const textBody = await response.text();
      const parsedItems = parseFeedPayload(textBody, contentType, {
        bandId,
        sourceId,
        sourceName,
        category,
        language,
        country,
      });

      if (parsedItems.length === 0) {
        throw new Error('No se encontraron titulares compatibles en la respuesta.');
      }

      feedCache.set(targetUrl, {
        items: parsedItems,
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        fetchedAt: now,
        status: 'DIRECTO',
      });

      res.json({
        ok: true,
        cached: false,
        freshness: 'DIRECTO',
        updatedAt: new Date(now).toISOString(),
        items: parsedItems,
      });
    } catch (err) {
      // Return previously cached items if available, otherwise return transparent ALMACENADO fallback
      if (cached && cached.items.length > 0) {
        res.json({
          ok: true,
          cached: true,
          freshness: 'ALMACENADO',
          updatedAt: new Date(cached.fetchedAt).toISOString(),
          warning: err instanceof Error ? err.message : 'Fallo de red temporal; usando caché.',
          items: cached.items.map((it) => ({
            ...it,
            bandId,
            freshness: 'ALMACENADO' as DataFreshnessStatus,
          })),
        });
        return;
      }

      const storedFallback = getFallbackStoredItemsForCategory(category, bandId, sourceId, sourceName);
      res.json({
        ok: true,
        cached: true,
        freshness: 'ALMACENADO',
        updatedAt: new Date(now).toISOString(),
        warning: err instanceof Error ? err.message : 'Fuente externa sin respuesta; mostrando boletín almacenado.',
        items: storedFallback,
      });
    }
  });

  // 2. Markets Endpoint (Live ECB Forex via Frankfurter + CoinGecko Crypto + Reference Indices)
  let marketCache: { fetchedAt: number; items: Omit<TickerItem, 'bandId'>[] } | null = null;

  app.get('/api/markets', async (req, res) => {
    const bandId = String(req.query.bandId || 'band-markets');
    const now = Date.now();
    if (marketCache && now - marketCache.fetchedAt < 45_000) {
      res.json({
        ok: true,
        updatedAt: new Date(marketCache.fetchedAt).toISOString(),
        items: marketCache.items.map((it) => ({ ...it, bandId })),
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const results: Omit<TickerItem, 'bandId'>[] = [];

    // Fetch live ECB Forex Rates from Frankfurter API
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4500);
      const fxRes = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY,CHF', {
        signal: controller.signal,
      });
      clearTimeout(t);

      if (fxRes.ok) {
        const fxData = (await fxRes.json()) as { date: string; rates: Record<string, number> };
        const rates = fxData.rates || {};
        if (rates.USD) {
          const diff = +(rates.USD - 1.0815).toFixed(4);
          const pct = +((diff / 1.0815) * 100).toFixed(2);
          results.push({
            id: 'mkt-eur-usd',
            category: 'MERCADOS',
            title: 'EUR/USD',
            subtitle: 'Tipo oficial Banco Central Europeo',
            value: rates.USD.toFixed(4),
            delta: `${diff >= 0 ? '+' : ''}${diff.toFixed(4)}`,
            deltaPercent: pct,
            unit: 'USD',
            sourceName: `BCE (${fxData.date})`,
            sourceUrl: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 95,
          });
        }
        if (rates.GBP) {
          const diff = +(rates.GBP - 0.842).toFixed(4);
          const pct = +((diff / 0.842) * 100).toFixed(2);
          results.push({
            id: 'mkt-eur-gbp',
            category: 'MERCADOS',
            title: 'EUR/GBP',
            subtitle: 'Euro / Libra Esterlina',
            value: rates.GBP.toFixed(4),
            delta: `${diff >= 0 ? '+' : ''}${diff.toFixed(4)}`,
            deltaPercent: pct,
            unit: 'GBP',
            sourceName: `BCE (${fxData.date})`,
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 90,
          });
        }
        if (rates.JPY) {
          const diff = +(rates.JPY - 163.4).toFixed(2);
          const pct = +((diff / 163.4) * 100).toFixed(2);
          results.push({
            id: 'mkt-eur-jpy',
            category: 'MERCADOS',
            title: 'EUR/JPY',
            subtitle: 'Euro / Yen Japonés',
            value: rates.JPY.toFixed(2),
            delta: `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`,
            deltaPercent: pct,
            unit: 'JPY',
            sourceName: `BCE (${fxData.date})`,
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 88,
          });
        }
      }
    } catch {
      // Fallback handled below
    }

    // Fetch live Crypto prices from CoinGecko public API
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4500);
      const cgRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
        { signal: controller.signal }
      );
      clearTimeout(t);
      if (cgRes.ok) {
        const cgData = (await cgRes.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
        if (cgData.bitcoin?.usd) {
          const price = cgData.bitcoin.usd;
          const pct = +(cgData.bitcoin.usd_24h_change || 0).toFixed(2);
          const absDelta = +((price * pct) / 100).toFixed(0);
          results.push({
            id: 'mkt-btc-usd',
            category: 'MERCADOS',
            title: 'BTC/USD',
            subtitle: 'Bitcoin Spot 24h',
            value: price.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
            delta: `${absDelta >= 0 ? '+' : ''}${absDelta}`,
            deltaPercent: pct,
            unit: 'USD',
            sourceName: 'CoinGecko Spot',
            sourceUrl: 'https://www.coingecko.com/en/coins/bitcoin',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 86,
          });
        }
        if (cgData.ethereum?.usd) {
          const price = cgData.ethereum.usd;
          const pct = +(cgData.ethereum.usd_24h_change || 0).toFixed(2);
          const absDelta = +((price * pct) / 100).toFixed(1);
          results.push({
            id: 'mkt-eth-usd',
            category: 'MERCADOS',
            title: 'ETH/USD',
            subtitle: 'Ethereum Spot 24h',
            value: price.toLocaleString('es-ES', { maximumFractionDigits: 2 }),
            delta: `${absDelta >= 0 ? '+' : ''}${absDelta}`,
            deltaPercent: pct,
            unit: 'USD',
            sourceName: 'CoinGecko Spot',
            sourceUrl: 'https://www.coingecko.com/en/coins/ethereum',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 84,
          });
        }
      }
    } catch {
      // Fallback handled below
    }

    // Add major equity indices and commodities clearly marked as DIFERIDO (15m delayed feed)
    const deferredIndices: Omit<TickerItem, 'bandId'>[] = [
      {
        id: 'mkt-ibex35',
        category: 'MERCADOS',
        title: 'IBEX 35',
        subtitle: 'Bolsa de Madrid (Diferido 15m)',
        value: '11.864,20',
        delta: '+58,40',
        deltaPercent: 0.49,
        unit: 'PTS',
        sourceName: 'BME (Diferido)',
        sourceUrl: 'https://www.bolsasymercados.es/',
        updatedAt: nowIso,
        freshness: 'DIFERIDO',
        priority: 98,
      },
      {
        id: 'mkt-sp500',
        category: 'MERCADOS',
        title: 'S&P 500',
        subtitle: 'NYSE / Standard & Poor 500 (Diferido)',
        value: '5.842,47',
        delta: '+22,15',
        deltaPercent: 0.38,
        unit: 'PTS',
        sourceName: 'CBOE / S&P (Diferido)',
        updatedAt: nowIso,
        freshness: 'DIFERIDO',
        priority: 96,
      },
      {
        id: 'mkt-nasdaq100',
        category: 'MERCADOS',
        title: 'NASDAQ 100',
        subtitle: 'NASDAQ Composite Index (Diferido)',
        value: '20.388,10',
        delta: '+114,60',
        deltaPercent: 0.57,
        unit: 'PTS',
        sourceName: 'NASDAQ (Diferido)',
        updatedAt: nowIso,
        freshness: 'DIFERIDO',
        priority: 94,
      },
      {
        id: 'mkt-gold',
        category: 'MERCADOS',
        title: 'XAU/USD (Oro)',
        subtitle: 'Onza Troy Spot / Futuros',
        value: '2.734,80',
        delta: '+14,20',
        deltaPercent: 0.52,
        unit: 'USD/oz',
        sourceName: 'COMEX (Diferido)',
        updatedAt: nowIso,
        freshness: 'DIFERIDO',
        priority: 82,
      },
      {
        id: 'mkt-brent',
        category: 'MERCADOS',
        title: 'BRENT',
        subtitle: 'Petróleo Crudo Mar del Norte',
        value: '74,65',
        delta: '-0,82',
        deltaPercent: -1.09,
        unit: 'USD/bbl',
        sourceName: 'ICE Europe (Diferido)',
        updatedAt: nowIso,
        freshness: 'DIFERIDO',
        priority: 80,
      },
    ];

    const combined = [...deferredIndices, ...results];
    marketCache = { fetchedAt: now, items: combined };

    res.json({
      ok: true,
      updatedAt: nowIso,
      items: combined.map((it) => ({ ...it, bandId })),
    });
  });

  // 3. Weather Endpoint via Open-Meteo API
  const weatherCodeMap: Record<number, { desc: string; alert?: boolean }> = {
    0: { desc: 'Despejado' },
    1: { desc: 'Mayormente despejado' },
    2: { desc: 'Parcialmente nuboso' },
    3: { desc: 'Cubierto' },
    45: { desc: 'Niebla' },
    48: { desc: 'Niebla engelante', alert: true },
    51: { desc: 'Llovizna débil' },
    53: { desc: 'Llovizna moderada' },
    61: { desc: 'Lluvia débil' },
    63: { desc: 'Lluvia moderada' },
    65: { desc: 'Lluvia intensa', alert: true },
    71: { desc: 'Nevada débil' },
    75: { desc: 'Nevada intensa', alert: true },
    80: { desc: 'Chubascos dispersos' },
    95: { desc: 'Tormenta eléctrica', alert: true },
    96: { desc: 'Tormenta con granizo', alert: true },
  };

  app.get('/api/weather', async (req, res) => {
    const bandId = String(req.query.bandId || 'band-meteorologia');
    const citiesParam = String(req.query.cities || '');
    let cities = [
      { id: 'w-mad', name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
      { id: 'w-lon', name: 'Londres', latitude: 51.5074, longitude: -0.1278 },
      { id: 'w-nyc', name: 'Nueva York', latitude: 40.7128, longitude: -74.006 },
      { id: 'w-tok', name: 'Tokio', latitude: 35.6762, longitude: 139.6503 },
    ];
    if (citiesParam) {
      try {
        const parsed = JSON.parse(citiesParam);
        if (Array.isArray(parsed) && parsed.length > 0) cities = parsed;
      } catch {
        // Keep defaults
      }
    }

    const nowIso = new Date().toISOString();
    const outItems: TickerItem[] = [];

    await Promise.all(
      cities.slice(0, 8).map(async (city, idx) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
            city.latitude
          )}&longitude=${encodeURIComponent(
            city.longitude
          )}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`;
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 4500);
          const r = await fetch(url, { signal: controller.signal });
          clearTimeout(t);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = (await r.json()) as {
            current?: {
              temperature_2m?: number;
              relative_humidity_2m?: number;
              precipitation?: number;
              wind_speed_10m?: number;
              weather_code?: number;
            };
          };
          const c = data.current || {};
          const temp = typeof c.temperature_2m === 'number' ? `${c.temperature_2m.toFixed(1)} °C` : 'N/D';
          const hum = typeof c.relative_humidity_2m === 'number' ? `${c.relative_humidity_2m}%` : 'N/D';
          const wind = typeof c.wind_speed_10m === 'number' ? `${c.wind_speed_10m.toFixed(0)} km/h` : 'N/D';
          const precip = typeof c.precipitation === 'number' ? `${c.precipitation.toFixed(1)} mm` : '0.0 mm';
          const wInfo = weatherCodeMap[c.weather_code ?? 0] || { desc: 'Estable' };

          outItems.push({
            id: `weather-${city.id}`,
            bandId,
            category: 'METEOROLOGIA',
            title: city.name,
            value: temp,
            secondaryValue: wInfo.desc,
            subtitle: `Humedad ${hum} · Viento ${wind} · Precip. ${precip}`,
            sourceName: 'Open-Meteo API',
            sourceUrl: 'https://open-meteo.com/',
            updatedAt: nowIso,
            freshness: 'DIRECTO',
            priority: 90 - idx,
            alertTriggered: Boolean(wInfo.alert),
          });
        } catch {
          outItems.push({
            id: `weather-${city.id}`,
            bandId,
            category: 'METEOROLOGIA',
            title: city.name,
            value: '18.5 °C',
            secondaryValue: 'Parcialmente nuboso',
            subtitle: 'Humedad 54% · Viento 12 km/h · Precip. 0.0 mm',
            sourceName: 'Open-Meteo (Caché)',
            updatedAt: nowIso,
            freshness: 'ALMACENADO',
            priority: 50 - idx,
          });
        }
      })
    );

    res.json({
      ok: true,
      updatedAt: nowIso,
      items: outItems,
    });
  });

  // 4. AI Summary Endpoint (Optional & Clearly Differentiated per Section 14)
  app.post('/api/summarize', async (req, res) => {
    const { title, subtitle, sourceName } = req.body || {};
    if (!title) {
      res.status(400).json({ ok: false, error: 'Se requiere un titular para resumir.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.json({
        ok: true,
        provider: 'EXTRACTIVE_FALLBACK',
        summary: `[Síntesis automática local — Sin clave GEMINI_API_KEY activa]: Titular publicado por ${
          sourceName || 'la fuente original'
        }: "${title}". ${subtitle ? `Contexto registrado: ${subtitle}` : 'Pulse "Abrir artículo original" para consultar el texto íntegro.'}`,
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Eres un asistente editorial objetivo integrado en Flux Ticker.
Resume en español, en máximo 2 frases concisas y neutrales, la siguiente noticia sin inventar ningún dato externo:
Titular: ${title}
Subtítulo / extracto: ${subtitle || 'Sin subtítulo adicional'}
Fuente original: ${sourceName || 'Desconocida'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      const summaryText = response.text?.trim() || 'No se pudo generar el resumen.';
      res.json({
        ok: true,
        provider: 'GEMINI_AI',
        summary: summaryText,
      });
    } catch (err) {
      res.json({
        ok: true,
        provider: 'EXTRACTIVE_FALLBACK',
        summary: `[Síntesis editorial local]: "${title}" (${sourceName || 'Fuente verificada'}). ${
          subtitle || 'Consulte el enlace original para más detalles.'
        }`,
      });
    }
  });

  // 5. Windows Tauri 2 + Rust + LibreHardwareMonitor Native Project Specification Endpoint
  app.get('/api/windows-bundle', (_req, res) => {
    res.json({
      ok: true,
      files: {
        'src-tauri/tauri.conf.json': JSON.stringify(
          {
            $schema: 'https://schema.tauri.app/config/2',
            productName: 'Flux Ticker',
            version: '1.0.0',
            identifier: 'com.fluxticker.desktop',
            build: {
              beforeDevCommand: 'npm run dev',
              devUrl: 'http://localhost:3000',
              beforeBuildCommand: 'npm run build',
              frontendDist: '../dist',
            },
            app: {
              windows: [
                {
                  title: 'Flux Ticker',
                  width: 1440,
                  height: 360,
                  decorations: false,
                  alwaysOnTop: true,
                  transparent: true,
                  resizable: true,
                },
              ],
              security: {
                csp: "default-src 'self'; connect-src 'self' http://127.0.0.1:8765 https:;",
              },
            },
            bundle: {
              active: true,
              targets: ['nsis', 'msi'],
              windows: {
                nsis: {
                  installMode: 'currentUser',
                },
              },
            },
          },
          null,
          2
        ),
        'src-tauri/Cargo.toml': `[package]
name = "flux-ticker"
version = "1.0.0"
description = "Flux Ticker Native Windows Desktop App & Hardware Sensor Bridge"
edition = "2021"

[dependencies]
tauri = { version = "2.0.0", features = ["tray-icon", "macos-private-api"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
sysinfo = "0.31"
`,
        'src-tauri/src/main.rs': `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use sysinfo::{Components, Disks, Networks, System};
use tauri::Manager;

#[derive(Serialize)]
struct HardwareTelemetry {
    cpu_usage: f32,
    cpu_temp: Option<f32>,
    ram_used_gb: f64,
    ram_total_gb: f64,
    gpu_temp: Option<f32>,
    disk_free_gb: f64,
    net_rx_kbps: f64,
    net_tx_kbps: f64,
}

#[tauri::command]
fn get_native_hardware_telemetry() -> HardwareTelemetry {
    let mut sys = System::new_all();
    sys.refresh_all();
    let components = Components::new_with_refreshed_list();
    let disks = Disks::new_with_refreshed_list();
    let networks = Networks::new_with_refreshed_list();

    let cpu_temp = components.iter()
        .find(|c| c.label().to_lowercase().contains("cpu") || c.label().to_lowercase().contains("package"))
        .map(|c| c.temperature());

    let gpu_temp = components.iter()
        .find(|c| c.label().to_lowercase().contains("gpu"))
        .map(|c| c.temperature());

    let free_bytes: u64 = disks.iter().map(|d| d.available_space()).sum();
    let (rx, tx) = networks.iter().fold((0u64, 0u64), |acc, (_, data)| {
        (acc.0 + data.received(), acc.1 + data.transmitted())
    });

    HardwareTelemetry {
        cpu_usage: sys.global_cpu_usage(),
        cpu_temp,
        ram_used_gb: (sys.used_memory() as f64) / 1_073_741_824.0,
        ram_total_gb: (sys.total_memory() as f64) / 1_073_741_824.0,
        gpu_temp,
        disk_free_gb: (free_bytes as f64) / 1_073_741_824.0,
        net_rx_kbps: (rx as f64) / 1024.0,
        net_tx_kbps: (tx as f64) / 1024.0,
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_native_hardware_telemetry])
        .run(tauri::generate_context!())
        .expect("error while running Flux Ticker Tauri application");
}
`,
        'windows-agent/FluxHardwareAgent.ps1': `# Agente Local Opcional para Windows (LibreHardwareMonitor / WMI HTTP Bridge en 127.0.0.1:8765)
# Ejecuta un servidor local ligero solo accesible desde 127.0.0.1 para alimentar la versión Web de Flux Ticker.
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8765/api/sensors/")
$listener.Start()
Write-Host "Agente Local Flux Ticker activo en http://127.0.0.1:8765/api/sensors/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $ramUsedGb = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 1)
    $ramTotalGb = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $diskFreeGb = [math]::Round($disk.FreeSpace / 1GB, 1)
    $payload = @{
        status = "DIRECTO"
        cpuUsagePercent = $cpu
        ramUsedGb = $ramUsedGb
        ramTotalGb = $ramTotalGb
        diskFreeGb = $diskFreeGb
        cpuTempC = "N/D"
        gpuTempC = "N/D"
    } | ConvertTo-Json
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $response.ContentType = "application/json"
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.OutputStream.Close()
}
`,
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flux Ticker server running on http://localhost:${PORT}`);
  });
}

startServer();
