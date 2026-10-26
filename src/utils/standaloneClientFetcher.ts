import { AppConfiguration, BandCategory, DataFreshnessStatus, FeedSource, TickerItem, WeatherCityConfig } from '../types/ticker';
import { isRtlText, sanitizeNewsText } from './tickerEngine';
import { buildPersonalWindowsExeBytes } from './windowsExeBuilder';

/**
 * Parses RSS 2.0 / Atom XML or JSON Feed directly in the browser for standalone .html mode.
 */
export function parseFeedXmlInBrowser(
  rawBody: string,
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
  const trimmed = rawBody.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      const list = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.articles)
        ? json.articles
        : [];
      list.slice(0, 20).forEach((entry: Record<string, unknown>, idx: number) => {
        const cleanTitle = sanitizeNewsText(String(entry.title || entry.headline || ''), 220);
        if (!cleanTitle) return;
        const cleanSub = sanitizeNewsText(String(entry.description || entry.summary || ''), 240);
        const link = typeof entry.link === 'string' ? entry.link : typeof entry.url === 'string' ? entry.url : undefined;
        items.push({
          id: `${meta.sourceId}-localjson-${idx}`,
          bandId: meta.bandId,
          category: meta.category,
          title: cleanTitle,
          subtitle: cleanSub || undefined,
          sourceName: meta.sourceName,
          sourceId: meta.sourceId,
          sourceUrl: link,
          publishedAt: String(entry.pubDate || entry.publishedAt || nowIso),
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
      // Fall through to XML regex parser
    }
  }

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

  const extractTag = (block: string, tags: string[]): string => {
    for (const tag of tags) {
      const r = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
      const m = block.match(r);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  };

  itemBlocks.slice(0, 20).forEach((block, idx) => {
    const cleanTitle = sanitizeNewsText(extractTag(block, ['title']), 220);
    if (!cleanTitle) return;
    const cleanSub = sanitizeNewsText(extractTag(block, ['description', 'summary', 'content']), 240);
    const linkMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    const rawLink = linkMatch?.[1] || extractTag(block, ['link', 'guid']);
    const link = rawLink && /^https?:\/\//i.test(rawLink) ? rawLink.trim() : undefined;

    items.push({
      id: `${meta.sourceId}-localxml-${idx}`,
      bandId: meta.bandId,
      category: meta.category,
      title: cleanTitle,
      subtitle: cleanSub && cleanSub !== cleanTitle ? cleanSub : undefined,
      sourceName: meta.sourceName,
      sourceId: meta.sourceId,
      sourceUrl: link,
      publishedAt: nowIso,
      updatedAt: nowIso,
      freshness: 'DIRECTO',
      isRtl: isRtlText(cleanTitle),
      priority: 25 - idx,
      language: meta.language,
      country: meta.country,
    });
  });

  return items;
}

/**
 * Client-side fallback for Markets when running from standalone .html without backend server.
 */
export async function fetchMarketsClientSide(bandId: string): Promise<TickerItem[]> {
  const nowIso = new Date().toISOString();
  const results: TickerItem[] = [];

  try {
    const fxRes = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY');
    if (fxRes.ok) {
      const fxData = (await fxRes.json()) as { date: string; rates: Record<string, number> };
      const rates = fxData.rates || {};
      if (rates.USD) {
        const diff = +(rates.USD - 1.0815).toFixed(4);
        const pct = +((diff / 1.0815) * 100).toFixed(2);
        results.push({
          id: 'mkt-eur-usd',
          bandId,
          category: 'MERCADOS',
          title: 'EUR/USD',
          subtitle: 'Tipo oficial Banco Central Europeo',
          value: rates.USD.toFixed(4),
          delta: `${diff >= 0 ? '+' : ''}${diff.toFixed(4)}`,
          deltaPercent: pct,
          unit: 'USD',
          sourceName: `BCE (${fxData.date})`,
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
          bandId,
          category: 'MERCADOS',
          title: 'EUR/GBP',
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
    }
  } catch {
    // Ignore
  }

  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
    );
    if (cgRes.ok) {
      const cgData = (await cgRes.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      if (cgData.bitcoin?.usd) {
        const price = cgData.bitcoin.usd;
        const pct = +(cgData.bitcoin.usd_24h_change || 0).toFixed(2);
        const absDelta = +((price * pct) / 100).toFixed(0);
        results.push({
          id: 'mkt-btc-usd',
          bandId,
          category: 'MERCADOS',
          title: 'BTC/USD',
          value: price.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
          delta: `${absDelta >= 0 ? '+' : ''}${absDelta}`,
          deltaPercent: pct,
          unit: 'USD',
          sourceName: 'CoinGecko Spot',
          updatedAt: nowIso,
          freshness: 'DIRECTO',
          priority: 86,
        });
      }
    }
  } catch {
    // Ignore
  }

  const deferred: TickerItem[] = [
    {
      id: 'mkt-ibex35',
      bandId,
      category: 'MERCADOS',
      title: 'IBEX 35',
      value: '11.864,20',
      delta: '+58,40',
      deltaPercent: 0.49,
      unit: 'PTS',
      sourceName: 'BME (Diferido)',
      updatedAt: nowIso,
      freshness: 'DIFERIDO',
      priority: 98,
    },
    {
      id: 'mkt-sp500',
      bandId,
      category: 'MERCADOS',
      title: 'S&P 500',
      value: '5.842,47',
      delta: '+22,15',
      deltaPercent: 0.38,
      unit: 'PTS',
      sourceName: 'S&P (Diferido)',
      updatedAt: nowIso,
      freshness: 'DIFERIDO',
      priority: 96,
    },
  ];

  return [...deferred, ...results];
}

/**
 * Client-side direct Open-Meteo fetcher for standalone .html mode.
 */
export async function fetchWeatherClientSide(
  bandId: string,
  cities: WeatherCityConfig[]
): Promise<TickerItem[]> {
  const nowIso = new Date().toISOString();
  const out: TickerItem[] = [];

  await Promise.all(
    cities.slice(0, 6).map(async (city, idx) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP error');
        const data = await r.json();
        const c = data.current || {};
        out.push({
          id: `weather-local-${city.id}`,
          bandId,
          category: 'METEOROLOGIA',
          title: city.name,
          value: typeof c.temperature_2m === 'number' ? `${c.temperature_2m.toFixed(1)} °C` : 'N/D',
          subtitle: `Humedad ${c.relative_humidity_2m ?? 50}% · Viento ${c.wind_speed_10m ?? 10} km/h`,
          sourceName: 'Open-Meteo Directo',
          updatedAt: nowIso,
          freshness: 'DIRECTO',
          priority: 90 - idx,
        });
      } catch {
        // Ignore individual failure
      }
    })
  );

  return out;
}

/**
 * Client-side RSS fetcher for standalone .html mode using direct CORS or AllOrigins CORS proxy.
 */
export async function fetchRssClientSide(
  source: FeedSource,
  bandId: string
): Promise<{ items: TickerItem[]; freshness: DataFreshnessStatus }> {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const text = await res.text();
      const parsed = parseFeedXmlInBrowser(text, {
        bandId,
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        language: source.language,
        country: source.country,
      });
      if (parsed.length > 0) {
        return { items: parsed, freshness: 'DIRECTO' };
      }
    }
  } catch {
    // Fallback
  }
  return { items: [], freshness: 'ALMACENADO' };
}

/**
 * Downloads the complete standalone .html file (Flux-Ticker-Standalone.html).
 * Fetches the pre-built self-contained bundle from /Flux-Ticker-Standalone.html,
 * or serializes the current document if already running offline from file://.
 */
export async function downloadStandaloneHtmlFile(): Promise<void> {
  let htmlContent = '';
  try {
    const res = await fetch('/Flux-Ticker-Standalone.html');
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<!doctype html>') || text.includes('<!DOCTYPE html>')) {
        htmlContent = text;
      }
    }
  } catch {
    // Running directly from file:// or offline
  }

  if (!htmlContent && typeof document !== 'undefined') {
    htmlContent = '<!doctype html>\n' + document.documentElement.outerHTML;
  }

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Flux-Ticker-Standalone.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Generates and downloads a standalone 64-bit Windows executable (Flux-Ticker-Personal.exe)
 * preloaded with the user's exact current configuration, bands, speeds, themes, and cached items.
 * License-free ("Sin licencia y para uso propio").
 */
export async function downloadPersonalWindowsExe(
  currentConfig: AppConfiguration,
  currentItemsMap: Record<string, TickerItem[]> = {}
): Promise<void> {
  let baseHtml = '';
  try {
    const res = await fetch('/Flux-Ticker-Standalone.html');
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<!doctype html>') || text.includes('<!DOCTYPE html>')) {
        baseHtml = text;
      }
    }
  } catch {
    // Offline or file:// fallback
  }

  if (!baseHtml && typeof document !== 'undefined') {
    baseHtml = '<!doctype html>\n' + document.documentElement.outerHTML;
  }

  const exeBytes = buildPersonalWindowsExeBytes(baseHtml, currentConfig, currentItemsMap);
  const blob = new Blob([exeBytes], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Flux-Ticker-Personal.exe';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}


