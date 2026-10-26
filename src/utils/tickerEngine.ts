import {
  AppConfiguration,
  BandConfig,
  BandStyleConfig,
  FeedSource,
  KeywordAlertRule,
  TickerItem,
  WorldCityConfig,
} from '../types/ticker';

/**
 * Validates external feed URLs and prevents SSRF attacks against private/loopback networks
 * unless explicitly marked as local hardware agent on localhost.
 */
export function validateSourceUrl(
  rawUrl: string,
  allowLocalAgent = false
): { valid: boolean; reason?: string; normalizedUrl?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'La URL está vacía o no es válida.' };
  }
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Formato de URL inválido. Use https:// o http://.' };
  }

  const allowedProtocols = allowLocalAgent
    ? ['http:', 'https:', 'ws:', 'wss:']
    : ['http:', 'https:'];

  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      valid: false,
      reason: `Protocolo no permitido (${parsed.protocol}). Solo se admiten HTTP/HTTPS.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check private/internal IP ranges to prevent SSRF
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  const isPrivateNetwork =
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local');

  if (isLoopback && !allowLocalAgent) {
    return {
      valid: false,
      reason: 'Por seguridad (anti-SSRF), las fuentes RSS no pueden apuntar a localhost.',
    };
  }

  if (isPrivateNetwork && !allowLocalAgent) {
    return {
      valid: false,
      reason: 'Por seguridad (anti-SSRF), no se permiten direcciones de red privada.',
    };
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}

/**
 * Sanitizes incoming RSS/Atom/JSON strings to prevent XSS and strip HTML tags/entities cleanly.
 */
export function sanitizeNewsText(input: string | undefined | null, maxLength = 280): string {
  if (!input || typeof input !== 'string') return '';
  let text = input
    // Remove script and style blocks completely
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    // Strip CDATA wrappers
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    // Strip remaining HTML tags
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 1).trimEnd() + '…';
  }
  return text;
}

/**
 * Detects whether a text string is predominantly written in a Right-to-Left (RTL) script
 * (Arabic, Hebrew, Persian, Urdu, Syriac, Thaana).
 */
export function isRtlText(text: string): boolean {
  if (!text) return false;
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g;
  const ltrRegex = /[A-Za-z\u00C0-\u024F]/g;
  const rtlMatches = (text.match(rtlRegex) || []).length;
  const ltrMatches = (text.match(ltrRegex) || []).length;
  return rtlMatches > 0 && rtlMatches >= ltrMatches * 0.4;
}

/**
 * Normalizes a headline into significant lowercase tokens for similarity & duplicate detection.
 */
export function tokenizeHeadline(title: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'a', 'por', 'para', 'con', 'se', 'su', 'al', 'es',
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'are', 'with', 'by', 'from', 'as'
  ]);
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Determines whether two headlines are exact duplicates or substantially equivalent
 * using token Jaccard similarity and prefix matching.
 */
export function areHeadlinesEquivalent(titleA: string, titleB: string, threshold = 0.62): boolean {
  if (!titleA || !titleB) return false;
  const normA = titleA.trim().toLowerCase();
  const normB = titleB.trim().toLowerCase();
  if (normA === normB) return true;

  const tokensA = tokenizeHeadline(titleA);
  const tokensB = tokenizeHeadline(titleB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return normA === normB;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : intersection / union;
  return jaccard >= threshold;
}

/**
 * Removes duplicate or substantially equivalent news items while preserving priority/order.
 */
export function deduplicateItems(items: TickerItem[], similarityThreshold = 0.62): TickerItem[] {
  const result: TickerItem[] = [];
  for (const item of items) {
    const isDuplicate = result.some(
      (existing) =>
        existing.category === item.category &&
        areHeadlinesEquivalent(existing.title, item.title, similarityThreshold)
    );
    if (!isDuplicate) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Filters and sorts ticker items for a specific band according to source trust lists,
 * language, country, region, inclusion/exclusion keywords, and sort mode.
 */
export function filterAndSortBandItems(
  items: TickerItem[],
  band: BandConfig,
  sourcesMap: Map<string, FeedSource>
): TickerItem[] {
  const includeKeywords = (band.filterKeywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const excludeKeywords = (band.blockedKeywords || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);

  const filtered = items.filter((item) => {
    // 1. Check source blocklist
    if (item.sourceId) {
      const src = sourcesMap.get(item.sourceId);
      if (src && src.trustLevel === 'BLOCKED') return false;
      if (src && !src.enabled) return false;
    }

    // 2. Language filter
    if (
      band.languageFilter &&
      band.languageFilter !== 'ALL' &&
      item.language &&
      item.language.toLowerCase() !== band.languageFilter.toLowerCase()
    ) {
      return false;
    }

    // 3. Country filter
    if (
      band.countryFilter &&
      band.countryFilter !== 'ALL' &&
      item.country &&
      item.country.toUpperCase() !== band.countryFilter.toUpperCase()
    ) {
      return false;
    }

    // 4. Region / Local filter
    if (
      band.regionFilter &&
      band.regionFilter !== 'ALL' &&
      item.region &&
      !item.region.toLowerCase().includes(band.regionFilter.toLowerCase())
    ) {
      return false;
    }

    const searchable = `${item.title} ${item.subtitle || ''} ${item.sourceName} ${(item.tags || []).join(' ')}`.toLowerCase();

    // 5. Blocked keywords
    if (excludeKeywords.some((kw) => searchable.includes(kw))) {
      return false;
    }

    // 6. Required filter keywords (if any configured)
    if (includeKeywords.length > 0 && !includeKeywords.some((kw) => searchable.includes(kw))) {
      return false;
    }

    return true;
  });

  const deduplicated = deduplicateItems(filtered);

  return deduplicated.sort((a, b) => {
    if (band.sortOrder === 'PRIORITY') {
      const srcA = a.sourceId ? sourcesMap.get(a.sourceId) : undefined;
      const srcB = b.sourceId ? sourcesMap.get(b.sourceId) : undefined;
      const boostA = (srcA?.trustLevel === 'PRIORITY' ? 100 : 0) + (a.alertTriggered ? 200 : 0) + a.priority;
      const boostB = (srcB?.trustLevel === 'PRIORITY' ? 100 : 0) + (b.alertTriggered ? 200 : 0) + b.priority;
      if (boostB !== boostA) return boostB - boostA;
    }
    const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Evaluates smart keyword alert rules against a list of ticker items and marks items that trigger alerts.
 */
export function evaluateKeywordAlerts(
  items: TickerItem[],
  rules: KeywordAlertRule[]
): { updatedItems: TickerItem[]; triggeredRules: Record<string, number> } {
  const activeRules = rules.filter((r) => r.enabled && r.keyword.trim().length > 0);
  const triggeredRules: Record<string, number> = {};

  if (activeRules.length === 0) {
    return { updatedItems: items, triggeredRules };
  }

  const updatedItems = items.map((item) => {
    const text = `${item.title} ${item.subtitle || ''}`.toLowerCase();
    let matched = false;
    for (const rule of activeRules) {
      if (text.includes(rule.keyword.trim().toLowerCase())) {
        matched = true;
        triggeredRules[rule.id] = (triggeredRules[rule.id] || 0) + 1;
      }
    }
    if (matched !== Boolean(item.alertTriggered)) {
      return { ...item, alertTriggered: matched };
    }
    return item;
  });

  return { updatedItems, triggeredRules };
}

/**
 * Generates accurate real-time World Clock ticker items for all configured cities.
 */
export function computeWorldClockItems(
  bandId: string,
  cities: WorldCityConfig[],
  referenceDate: Date = new Date()
): TickerItem[] {
  return cities.map((city, idx) => {
    try {
      const timeFormatter = new Intl.DateTimeFormat('es-ES', {
        timeZone: city.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: city.showSeconds ? '2-digit' : undefined,
        hour12: false,
      });

      const dateFormatter = new Intl.DateTimeFormat('es-ES', {
        timeZone: city.timeZone,
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      });

      const offsetFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: city.timeZone,
        timeZoneName: 'shortOffset',
      });

      const timeStr = timeFormatter.format(referenceDate);
      const dateStr = city.showDate ? dateFormatter.format(referenceDate).replace('.', '') : '';
      const offsetParts = offsetFormatter.formatToParts(referenceDate);
      const rawOffset = offsetParts.find((p) => p.type === 'timeZoneName')?.value || city.timeZone;
      const utcOffset = rawOffset.replace('GMT', 'UTC');

      return {
        id: `clock-${city.id}`,
        bandId,
        category: 'RELOJ_MUNDIAL',
        title: city.name,
        subtitle: city.showDate ? `${dateStr}` : city.country,
        value: timeStr,
        secondaryValue: city.showOffset ? utcOffset : undefined,
        sourceName: city.timeZone,
        updatedAt: referenceDate.toISOString(),
        freshness: 'DIRECTO',
        priority: 100 - idx,
        country: city.country,
      };
    } catch {
      return {
        id: `clock-${city.id}`,
        bandId,
        category: 'RELOJ_MUNDIAL',
        title: city.name,
        value: 'N/D',
        subtitle: 'Zona horaria no disponible',
        sourceName: city.timeZone,
        updatedAt: referenceDate.toISOString(),
        freshness: 'NO_DISPONIBLE',
        priority: 0,
      };
    }
  });
}

/**
 * Exports a list of FeedSources into standard OPML 2.0 XML format.
 */
export function generateOpml(sources: FeedSource[], title = 'Flux Ticker Suscripciones RSS'): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const outlines = sources
    .filter((s) => s.format === 'RSS' || s.format === 'ATOM' || s.format === 'JSON_FEED')
    .map(
      (s) =>
        `      <outline type="rss" text="${escapeXml(s.name)}" title="${escapeXml(
          s.name
        )}" xmlUrl="${escapeXml(s.url)}" category="${escapeXml(s.category)}" language="${escapeXml(
          s.language || 'es'
        )}" />`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Flux Ticker Feeds" title="Flux Ticker Feeds">
${outlines}
    </outline>
  </body>
</opml>`;
}

/**
 * Parses an OPML XML string and extracts valid feed outlines.
 */
export function parseOpml(opmlContent: string): Array<{
  name: string;
  url: string;
  category?: string;
  language?: string;
}> {
  if (!opmlContent || typeof opmlContent !== 'string') return [];
  const results: Array<{ name: string; url: string; category?: string; language?: string }> = [];
  const outlineRegex = /<outline\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  const getAttr = (attrs: string, name: string): string | undefined => {
    const r = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i');
    const m = attrs.match(r);
    return m ? m[1].trim() : undefined;
  };

  while ((match = outlineRegex.exec(opmlContent)) !== null) {
    const attrs = match[1];
    const xmlUrl = getAttr(attrs, 'xmlUrl') || getAttr(attrs, 'url');
    if (!xmlUrl) continue;
    const validation = validateSourceUrl(xmlUrl, false);
    if (!validation.valid || !validation.normalizedUrl) continue;

    const title = getAttr(attrs, 'title') || getAttr(attrs, 'text') || validation.normalizedUrl;
    const category = getAttr(attrs, 'category');
    const language = getAttr(attrs, 'language');

    results.push({
      name: sanitizeNewsText(title, 80),
      url: validation.normalizedUrl,
      category,
      language,
    });
  }

  return results;
}

/**
 * Validates an imported JSON AppConfiguration object against required schema invariants.
 */
export function validateAppConfig(
  raw: unknown
): { valid: boolean; error?: string; config?: AppConfiguration } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'El archivo JSON no contiene un objeto de configuración válido.' };
  }
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.version !== 'string') {
    return { valid: false, error: 'Falta la propiedad "version" en el esquema JSON.' };
  }
  if (!Array.isArray(candidate.bands)) {
    return { valid: false, error: 'La propiedad "bands" debe ser una lista de bandas.' };
  }
  if (!Array.isArray(candidate.sources)) {
    return { valid: false, error: 'La propiedad "sources" debe ser una lista de fuentes.' };
  }

  for (const b of candidate.bands) {
    if (!b || typeof b !== 'object' || typeof (b as BandConfig).id !== 'string' || typeof (b as BandConfig).category !== 'string') {
      return { valid: false, error: 'Una o más bandas tienen un esquema inválido.' };
    }
  }

  return { valid: true, config: candidate as unknown as AppConfiguration };
}

/**
 * Returns default per-band typography & dimension parameters for instant restoration.
 */
export function getDefaultBandStyle(theme: 'DARK' | 'LIGHT' | 'MONOCHROME' | 'CUSTOM' = 'DARK', accentColor = '#38bdf8'): BandStyleConfig {
  const isLight = theme === 'LIGHT';
  return {
    fontSize: 14,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 500,
    letterSpacing: 0.01,
    indentLeft: 0,
    indentRight: 0,
    paddingY: 8,
    paddingX: 12,
    marginY: 0,
    bandHeight: 56,
    bandGap: 1,
    verticalAlign: 'center',
    itemSeparatorSpacing: 36,
    itemSeparatorSymbol: '·',
    speedPxPerSec: 55,
    textColor: isLight ? '#0f172a' : '#f1f5f9',
    bgColor: isLight ? '#ffffff' : '#090d16',
    accentColor,
    borderColor: isLight ? '#e2e8f0' : '#1e293b',
    opacity: 1,
    showIcons: true,
    staticMode: false,
    pauseOnHover: true,
  };
}
