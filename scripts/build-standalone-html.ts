import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function buildStandaloneHtml() {
  const rootDir = process.cwd();
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  console.log('1. Running vite build to compile production assets...');
  execSync('npx vite build', { stdio: 'inherit', cwd: rootDir });

  const indexHtmlPath = path.join(distDir, 'index.html');
  const assetsDir = path.join(distDir, 'assets');

  let html = fs.readFileSync(indexHtmlPath, 'utf-8');
  const assetFiles = fs.readdirSync(assetsDir);

  const cssContents: string[] = [];
  const jsContents: string[] = [];

  for (const file of assetFiles) {
    const fullPath = path.join(assetsDir, file);
    if (file.endsWith('.css')) {
      cssContents.push(fs.readFileSync(fullPath, 'utf-8'));
    } else if (file.endsWith('.js')) {
      jsContents.push(fs.readFileSync(fullPath, 'utf-8'));
    }
  }

  // Remove external <link rel="stylesheet" href="/assets/..."> and <script type="module" crossorigin src="/assets/...">
  html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']\/?assets\/[^"']+["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]+src=["']\/?assets\/[^"']+["'][^>]*><\/script>/gi, '');

  const combinedCss = cssContents.join('\n');
  // Escape any literal "</script" sequences inside JS strings so inline <script> never closes early
  const combinedJs = jsContents.join('\n').replace(/<\/script/gi, '<\\/script');

  const inlineStyleTag = `<style id="flux-ticker-inline-styles">\n${combinedCss}\n</style>`;
  const inlineScriptTag = `<script type="module" id="flux-ticker-inline-bundle">\n${combinedJs}\n</script>`;

  html = html.replace('</head>', () => `${inlineStyleTag}\n</head>`);
  html = html.replace('</body>', () => `${inlineScriptTag}\n</body>`);

  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const targetPublicPath = path.join(publicDir, 'Flux-Ticker-Standalone.html');
  fs.writeFileSync(targetPublicPath, html, 'utf-8');

  // Also copy into dist/ so production server serves it as well
  const targetDistPath = path.join(distDir, 'Flux-Ticker-Standalone.html');
  fs.writeFileSync(targetDistPath, html, 'utf-8');

  const sizeKb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  console.log(`2. Successfully generated /public/Flux-Ticker-Standalone.html (${sizeKb} KB)`);
}

buildStandaloneHtml();
