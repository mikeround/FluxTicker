import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSourceUrl,
  sanitizeNewsText,
  isRtlText,
  areHeadlinesEquivalent,
  deduplicateItems,
  filterAndSortBandItems,
  computeWorldClockItems,
  generateOpml,
  parseOpml,
  validateAppConfig,
  getDefaultBandStyle,
} from './tickerEngine';
import { BandConfig, FeedSource, TickerItem } from '../types/ticker';

test('validateSourceUrl allows public HTTP/HTTPS and blocks SSRF private/loopback addresses', () => {
  const validHttps = validateSourceUrl('https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada');
  assert.equal(validHttps.valid, true);

  const loopbackBlocked = validateSourceUrl('http://localhost:8080/admin');
  assert.equal(loopbackBlocked.valid, false);

  const loopbackAllowedForAgent = validateSourceUrl('http://localhost:8765/metrics', true);
  assert.equal(loopbackAllowedForAgent.valid, true);

  const privateIpBlocked = validateSourceUrl('http://192.168.1.15/rss.xml');
  assert.equal(privateIpBlocked.valid, false);

  const javascriptProtocolBlocked = validateSourceUrl('javascript:alert(1)');
  assert.equal(javascriptProtocolBlocked.valid, false);
});

test('sanitizeNewsText strips script tags, HTML markup, and decodes entities safely', () => {
  const dirty = '<![CDATA[<script>alert("xss")</script><p>El <b>Banco Central</b> mantiene tipos &amp; prevé crecimiento &quot;estable&quot;.</p>]]>';
  const clean = sanitizeNewsText(dirty);
  assert.equal(clean, 'El Banco Central mantiene tipos & prevé crecimiento "estable".');
});

test('isRtlText accurately identifies Arabic and Hebrew vs Spanish and English', () => {
  assert.equal(isRtlText('أسواق المال العالمية تسجل ارتفاعا'), true);
  assert.equal(isRtlText('חדשות כלכלה וטכנולוגיה'), true);
  assert.equal(isRtlText('Los mercados europeos abren al alza este lunes'), false);
  assert.equal(isRtlText('Global markets rally on inflation data'), false);
});

test('areHeadlinesEquivalent and deduplicateItems detect substantially equivalent news headlines', () => {
  const h1 = 'El Banco Central Europeo decide mantener los tipos de interés sin cambios en la eurozona';
  const h2 = 'Banco Central Europeo mantiene tipos de interés sin cambios en toda la eurozona';
  const h3 = 'Descubren un nuevo exoplaneta con atmósfera templada a 40 años luz';

  assert.equal(areHeadlinesEquivalent(h1, h2), true);
  assert.equal(areHeadlinesEquivalent(h1, h3), false);

  const items: TickerItem[] = [
    {
      id: '1',
      bandId: 'b1',
      category: 'ECONOMIA',
      title: h1,
      sourceName: 'Agencia A',
      updatedAt: new Date().toISOString(),
      freshness: 'DIRECTO',
      priority: 10,
    },
    {
      id: '2',
      bandId: 'b1',
      category: 'ECONOMIA',
      title: h2,
      sourceName: 'Agencia B',
      updatedAt: new Date().toISOString(),
      freshness: 'DIRECTO',
      priority: 5,
    },
    {
      id: '3',
      bandId: 'b1',
      category: 'ECONOMIA',
      title: h3,
      sourceName: 'Ciencia Hoy',
      updatedAt: new Date().toISOString(),
      freshness: 'DIRECTO',
      priority: 8,
    },
  ];

  const deduped = deduplicateItems(items);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, '1');
  assert.equal(deduped[1].id, '3');
});

test('filterAndSortBandItems respects blocked sources, keywords, language, and priority sorting', () => {
  const sources = new Map<string, FeedSource>([
    [
      'src-priority',
      {
        id: 'src-priority',
        name: 'Fuente Prioritaria',
        url: 'https://example.com/rss1',
        format: 'RSS',
        category: 'ECONOMIA',
        officialProvider: true,
        language: 'es',
        country: 'ES',
        trustLevel: 'PRIORITY',
        refreshIntervalSec: 300,
        lastStatus: 'DIRECTO',
        itemCount: 5,
        enabled: true,
      },
    ],
    [
      'src-blocked',
      {
        id: 'src-blocked',
        name: 'Fuente Bloqueada',
        url: 'https://example.com/rss2',
        format: 'RSS',
        category: 'ECONOMIA',
        officialProvider: false,
        language: 'es',
        country: 'ES',
        trustLevel: 'BLOCKED',
        refreshIntervalSec: 300,
        lastStatus: 'DIRECTO',
        itemCount: 5,
        enabled: true,
      },
    ],
  ]);

  const band: BandConfig = {
    id: 'band-eco',
    name: 'Economía',
    category: 'ECONOMIA',
    enabled: true,
    hidden: false,
    paused: false,
    order: 1,
    style: getDefaultBandStyle(),
    sourceIds: ['src-priority', 'src-blocked'],
    filterKeywords: ['inflación'],
    blockedKeywords: ['rumor'],
    languageFilter: 'es',
    countryFilter: 'ALL',
    regionFilter: 'ALL',
    sortOrder: 'PRIORITY',
  };

  const items: TickerItem[] = [
    {
      id: 'i1',
      bandId: 'band-eco',
      category: 'ECONOMIA',
      title: 'La inflación interanual se modera en la zona euro',
      sourceName: 'Fuente Prioritaria',
      sourceId: 'src-priority',
      language: 'es',
      updatedAt: '2026-10-26T08:00:00Z',
      freshness: 'DIRECTO',
      priority: 10,
    },
    {
      id: 'i2',
      bandId: 'band-eco',
      category: 'ECONOMIA',
      title: 'La inflación sube según fuente bloqueada',
      sourceName: 'Fuente Bloqueada',
      sourceId: 'src-blocked',
      language: 'es',
      updatedAt: '2026-10-26T08:05:00Z',
      freshness: 'DIRECTO',
      priority: 50,
    },
    {
      id: 'i3',
      bandId: 'band-eco',
      category: 'ECONOMIA',
      title: 'Rumor sobre inflación sin confirmar',
      sourceName: 'Fuente Prioritaria',
      sourceId: 'src-priority',
      language: 'es',
      updatedAt: '2026-10-26T08:10:00Z',
      freshness: 'DIRECTO',
      priority: 20,
    },
  ];

  const out = filterAndSortBandItems(items, band, sources);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'i1');
});

test('computeWorldClockItems formats international cities with timezones accurately', () => {
  const cities = [
    { id: 'mad', name: 'Madrid', country: 'España', timeZone: 'Europe/Madrid', showDate: true, showSeconds: true, showOffset: true },
    { id: 'tok', name: 'Tokio', country: 'Japón', timeZone: 'Asia/Tokyo', showDate: true, showSeconds: true, showOffset: true },
  ];
  const items = computeWorldClockItems('band-clock', cities, new Date('2026-10-26T12:00:00Z'));
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Madrid');
  assert.equal(items[0].freshness, 'DIRECTO');
  assert.ok(items[0].value && items[0].value.includes(':'));
});

test('generateOpml and parseOpml round-trip valid RSS feeds cleanly', () => {
  const sources: FeedSource[] = [
    {
      id: 's1',
      name: 'El País Portada',
      url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
      format: 'RSS',
      category: 'ACTUALIDAD',
      officialProvider: true,
      language: 'es',
      country: 'ES',
      trustLevel: 'AUTHORIZED',
      refreshIntervalSec: 300,
      lastStatus: 'DIRECTO',
      itemCount: 10,
      enabled: true,
    },
  ];
  const xml = generateOpml(sources, 'Mi Exportación OPML');
  assert.ok(xml.includes('<opml version="2.0">'));
  const parsed = parseOpml(xml);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'El País Portada');
  assert.equal(parsed[0].url, 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada');
});

test('validateAppConfig validates schema structure and rejects malformed payloads', () => {
  const invalid = validateAppConfig({ version: 123 });
  assert.equal(invalid.valid, false);

  const valid = validateAppConfig({
    version: '1.0.0',
    bands: [{ id: 'b1', category: 'HARDWARE' }],
    sources: [],
  });
  assert.equal(valid.valid, true);
});

import { parseFeedXmlInBrowser } from './standaloneClientFetcher';

test('parseFeedXmlInBrowser parses RSS 2.0 XML in standalone browser mode', () => {
  const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title><![CDATA[Titular autónomo desde versión HTML]]></title>
        <description>Subtítulo de prueba autónomo</description>
        <link>https://www.rtve.es/noticias</link>
      </item>
    </channel>
  </rss>`;

  const items = parseFeedXmlInBrowser(sampleRss, {
    bandId: 'band-act',
    sourceId: 'src-test',
    sourceName: 'RTVE',
    category: 'ACTUALIDAD',
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Titular autónomo desde versión HTML');
  assert.equal(items[0].sourceUrl, 'https://www.rtve.es/noticias');
});

import { buildPersonalWindowsExeBytes } from './windowsExeBuilder';
import { INITIAL_APP_CONFIG } from '../data/defaultPresets';

test('buildPersonalWindowsExeBytes synthesizes a valid 64-bit PE32+ Windows .exe with embedded current config', () => {
  const sampleHtml = '<!doctype html><html><head><title>Flux</title></head><body><div id="root"></div></body></html>';
  const customConfig = {
    ...INITIAL_APP_CONFIG,
    monochromeColor: '#10b981',
  };
  const exe = buildPersonalWindowsExeBytes(sampleHtml, customConfig);
  const view = new DataView(exe.buffer);

  // Verify DOS 'MZ' header
  assert.equal(exe[0], 0x4d); // 'M'
  assert.equal(exe[1], 0x5a); // 'Z'
  const peOffset = view.getUint32(0x3c, true);
  assert.equal(peOffset, 0x80);

  // Verify 'PE\0\0' signature and AMD64 machine type (0x8664)
  assert.equal(exe[0x80], 0x50); // 'P'
  assert.equal(exe[0x81], 0x45); // 'E'
  assert.equal(view.getUint16(0x84, true), 0x8664);

  // Verify PE32+ Optional Header Magic (0x020B) and Windows GUI Subsystem (2)
  assert.equal(view.getUint16(0x98, true), 0x020b);
  assert.equal(view.getUint16(0x98 + 0x44, true), 2);

  // Verify embedded configuration and personal license-free declaration
  const decoded = new TextDecoder().decode(exe);
  assert.ok(decoded.includes('window.__FLUX_PRELOADED_CONFIG__'));
  assert.ok(decoded.includes('#10b981'));
  assert.ok(decoded.includes('Sin licencia y para uso propio'));
});


