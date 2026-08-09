#!/usr/bin/env node
/**
 * build-pages.mjs
 * Obsidian vault の zawato/github_pages/<topic>/index.md を読み込み、
 * リポジトリ直下の <topic>/index.html と contents/index.html を生成する。
 *
 * 使い方:
 *   node scripts/build-pages.mjs
 *   VAULT_PATH=/path/to/vault node scripts/build-pages.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { marked } from 'marked';
import matter from 'gray-matter';
import { replaceMarker, escapeHtml, formatDate } from './_utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

const DEFAULT_VAULT = join(
  process.env.HOME,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian'
);
const VAULT_PATH   = process.env.VAULT_PATH || DEFAULT_VAULT;
const PAGES_DIR    = join(VAULT_PATH, 'zawato/github_pages');
const INDEX_PATH   = join(ROOT, 'index.html');
const SITEMAP_PATH = join(ROOT, 'sitemap.xml');
const DEFAULT_OG   = 'https://zawato.github.io/images/og.png';

// サイトに出さないトピック。vault 側（zawato/github_pages/<topic>/）にソースは残す。
// ここはポートフォリオとして見せる場所なので、趣味のコンテンツは載せない。
const EXCLUDED_TOPICS = new Set(['kyoto', 'muscle', 'pasta']);

// トピック専用のテンプレートがあればそれを使う（scripts/_template-<topic>.html）。
// 無ければ全トピック共通の _template.html にフォールバックする。
const templateCache = new Map();
function templateFor(topic) {
  if (!templateCache.has(topic)) {
    const custom = join(__dirname, `_template-${topic}.html`);
    const path   = existsSync(custom) ? custom : join(__dirname, '_template.html');
    if (existsSync(custom)) console.log(`  (template: _template-${topic}.html)`);
    templateCache.set(topic, readFileSync(path, 'utf8'));
  }
  return templateCache.get(topic);
}

// marked の設定: GitHub Flavored Markdown 風
marked.setOptions({ gfm: true, breaks: false });

// ── フロントマター解析 ──────────────────────────────────────────────────────

function parsePage(mdPath, slug) {
  if (!existsSync(mdPath)) return null;
  const raw = readFileSync(mdPath, 'utf8');
  const { data, content } = matter(raw);
  return { slug, data, content };
}

// topic ディレクトリ内の全 .md を列挙する
// index.md        → { slug: 'muscle', outPath: 'muscle/index.html', isIndex: true }
// menu.md         → { slug: 'muscle/menu', outPath: 'muscle/menu.html', isIndex: false }
// 日本語名.md     → frontmatter の slug を優先。slug: 'menu' なら同上
function scanTopic(topic) {
  const dir = join(PAGES_DIR, topic);
  return readdirSync(dir, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.md') && !f.name.startsWith('_'))
    .map(f => {
      const mdPath   = join(dir, f.name);
      const { data } = matter(readFileSync(mdPath, 'utf8'));
      const isIndex  = f.name === 'index.md';
      const baseSlug = data.slug || f.name.replace(/\.md$/, '');
      const slug     = isIndex ? topic : `${topic}/${baseSlug}`;
      const outPath  = isIndex ? `${topic}/index.html` : `${topic}/${baseSlug}.html`;
      return { slug, mdPath, outPath, isIndex };
    });
}

// ── HTML 生成 ───────────────────────────────────────────────────────────────

function buildPageHTML(topic, slug, data, content) {
  const title       = data.title       || slug;
  const description = data.description || '';
  const updated     = data.updated     ? String(data.updated) : '';
  const tags        = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);
  const ogImage     = data.image       || DEFAULT_OG;
  const layout      = data.layout      || 'page';

  const updatedLine = updated
    ? `<p class="page-subtitle"><i class="fas fa-calendar-alt"></i> 更新日: ${escapeHtml(formatDate(updated))}</p>`
    : '';

  const tagsLine = tags.length
    ? `<div class="blog-tags">${tags.map(t => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const htmlContent = marked.parse(content);

  return templateFor(topic)
    .replace(/\{\{TITLE\}\}/g, escapeHtml(title))
    .replace(/\{\{DESCRIPTION\}\}/g, escapeHtml(description))
    .replace(/\{\{SLUG\}\}/g, escapeHtml(slug))
    .replace(/\{\{OG_IMAGE\}\}/g, escapeHtml(ogImage))
    .replace(/\{\{LAYOUT\}\}/g, escapeHtml(layout))
    .replace('{{UPDATED_LINE}}', updatedLine)
    .replace('{{TAGS_LINE}}', tagsLine)
    .replace('{{CONTENT}}', htmlContent);
}

// ── コンテンツ一覧ページ ────────────────────────────────────────────────────

function buildContentsPageHTML(pages) {
  const cards = pages.map(({ slug, data }) => {
    const title       = data.title       || slug;
    const description = data.description || '';
    const updated     = data.updated     ? String(data.updated) : '';
    const tags        = Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []);

    const tagsHTML = tags.map(t => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('');
    const dateHTML = updated
      ? `<span class="post-card-date"><i class="fas fa-calendar-alt"></i> ${escapeHtml(formatDate(updated))}</span>`
      : '';

    return `    <a href="/${escapeHtml(slug)}/" class="link-card">
      <div class="link-content">
        <h3 class="link-title">${escapeHtml(title)}</h3>
        <p class="link-description">${escapeHtml(description)}</p>
        <div class="blog-tags" style="margin-top:0.4rem">${tagsHTML}</div>
        ${dateHTML}
      </div>
      <div class="link-arrow"><i class="fas fa-chevron-right"></i></div>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="zawato が興味を持つトピックをまとめたコンテンツ集">
  <meta name="author" content="zawato">
  <link rel="canonical" href="https://zawato.github.io/contents/">

  <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png">

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://zawato.github.io/contents/">
  <meta property="og:title" content="コンテンツ | zawato">
  <meta property="og:description" content="zawato が興味を持つトピックをまとめたコンテンツ集">
  <meta property="og:image" content="https://zawato.github.io/images/og.png">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="コンテンツ | zawato">
  <meta name="twitter:description" content="zawato が興味を持つトピックをまとめたコンテンツ集">
  <meta name="twitter:image" content="https://zawato.github.io/images/og.png">

  <title>コンテンツ | zawato</title>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>

  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="site-logo">zawato</a>
      <nav class="header-nav" aria-label="メインナビゲーション">
        <a href="https://zawato.jp" target="_blank" rel="noopener me">ブログ</a>
        <a href="/contents/" aria-current="page">コンテンツ</a>
        <a href="/my-link/">リンク集</a>
        <a href="https://github.com/zawato" target="_blank" rel="noopener me">GitHub</a>
      </nav>
    </div>
  </header>

  <main class="main-content">

    <a href="/" class="back-link">
      <i class="fas fa-arrow-left"></i> ホームに戻る
    </a>

    <div class="page-header">
      <h1 class="page-title">コンテンツ</h1>
      <p class="page-subtitle">興味のあるトピックをまとめたページ集</p>
    </div>

    <section class="category-section">
      <div class="links-grid">
${pages.length ? cards : '        <p style="color:var(--text-muted)">コンテンツはまだありません。</p>'}
      </div>
    </section>

  </main>

  <footer class="footer">
    <div class="footer-inner">
      <p class="footer-brand">zawato</p>
      <p class="footer-links">
        <a href="https://zawato.jp" target="_blank" rel="noopener me">zawato.jp</a>
        &nbsp;·&nbsp;
        <a href="https://github.com/zawato" target="_blank" rel="noopener me">GitHub</a>
        &nbsp;·&nbsp;
        <a href="/">ホーム</a>
      </p>
      <p class="footer-copy">&copy; 2026 zawato. All rights reserved.</p>
    </div>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>`;
}

// ── sitemap 更新 ─────────────────────────────────────────────────────────────

function updateSitemap(pages) {
  let xml = readFileSync(SITEMAP_PATH, 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  // まず既存の PAGES ブロックを丸ごと置き換え
  const pagesXml = [
    { loc: 'https://zawato.github.io/contents/', priority: '0.8' },
    ...pages.map(p => ({ loc: `https://zawato.github.io/${p.slug}/`, priority: '0.7' })),
  ].map(({ loc, priority }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');

  // PAGES_START / PAGES_END マーカーが無い場合は </urlset> の直前に挿入
  if (xml.includes('<!-- PAGES_START -->')) {
    xml = replaceMarker(xml, 'PAGES', pagesXml);
  } else {
    xml = xml.replace(
      '</urlset>',
      `<!-- PAGES_START -->\n${pagesXml}\n<!-- PAGES_END -->\n</urlset>`
    );
  }

  writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log('✓ sitemap.xml updated');
}

// ── index.html の CONTENTS セクション更新 ──────────────────────────────────

function updateIndexContents(pages) {
  let html = readFileSync(INDEX_PATH, 'utf8');
  if (!html.includes('<!-- CONTENTS_START -->')) {
    console.log('⚠ index.html に CONTENTS マーカーが見つかりません。スキップ。');
    return;
  }

  const cards = pages.slice(0, 4).map(({ slug, data }) => {
    const title       = data.title       || slug;
    const description = data.description || '';
    return `        <a href="/${escapeHtml(slug)}/" class="link-card">
          <div class="link-content">
            <h3 class="link-title">${escapeHtml(title)}</h3>
            <p class="link-description">${escapeHtml(description)}</p>
          </div>
          <div class="link-arrow"><i class="fas fa-chevron-right"></i></div>
        </a>`;
  }).join('\n');

  const moreLink = `        <div style="text-align:right;margin-top:0.75rem">
          <a href="/contents/" class="btn btn-outline-sm"><i class="fas fa-list"></i> すべて見る</a>
        </div>`;

  html = replaceMarker(html, 'CONTENTS', pages.length ? `${cards}\n${moreLink}` : '        <p style="color:var(--text-muted)">コンテンツはまだありません。</p>');
  writeFileSync(INDEX_PATH, html, 'utf8');
  console.log('✓ index.html (CONTENTS) updated');
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(PAGES_DIR)) {
    console.error(`✗ PAGES_DIR が見つかりません: ${PAGES_DIR}`);
    process.exit(1);
  }

  // vault の zawato/github_pages/ を走査（`_` 始まりのディレクトリは除外）
  const topics = readdirSync(PAGES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name)
    .filter(topic => {
      if (EXCLUDED_TOPICS.has(topic)) {
        console.log(`  skip (excluded): ${topic}`);
        return false;
      }
      return true;
    });

  const pages = []; // コンテンツ一覧に載せる index ページのみ

  for (const topic of topics) {
    const entries = scanTopic(topic);

    for (const { slug, mdPath, outPath, isIndex } of entries) {
      const page = parsePage(mdPath, slug);
      if (!page) continue;
      if (page.data.draft) {
        console.log(`  skip (draft): ${slug}`);
        continue;
      }

      mkdirSync(join(ROOT, topic), { recursive: true });
      const html = buildPageHTML(topic, page.slug, page.data, page.content);
      writeFileSync(join(ROOT, outPath), html, 'utf8');
      console.log(`✓ ${outPath}`);

      if (isIndex) pages.push(page);
    }
  }

  // contents/index.html
  const contentsDir = join(ROOT, 'contents');
  mkdirSync(contentsDir, { recursive: true });
  writeFileSync(join(contentsDir, 'index.html'), buildContentsPageHTML(pages), 'utf8');
  console.log('✓ contents/index.html');

  // sitemap.xml
  updateSitemap(pages);

  // index.html の CONTENTS セクション
  updateIndexContents(pages);

  console.log(`\n完了。${pages.length} ページを生成しました。`);
}

main().catch(e => { console.error(e); process.exit(1); });
