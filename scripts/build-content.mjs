#!/usr/bin/env node
/**
 * build-content.mjs
 * zawato.jp RSS + GitHub API からデータを取得し、index.html の
 * マーカー領域（LATEST_POSTS / STATS / TOP_REPOS）を書き換える。
 * 依存ゼロ。Node.js 18+ の標準 fetch を使用。
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const INDEX_PATH = join(ROOT, 'index.html');

const BLOG_RSS_URL    = process.env.BLOG_RSS_URL    || 'https://zawato.jp/feed/';
const BLOG_BASE       = process.env.BLOG_BASE       || 'https://zawato.jp';
const GITHUB_USER     = process.env.GITHUB_USER     || 'zawato';
const GITHUB_API_BASE = 'https://api.github.com';

// ── utils ──────────────────────────────────────────────────────────────────

function replaceMarker(html, name, content) {
  const re = new RegExp(
    `(<!--\\s*${name}_START\\s*-->)[\\s\\S]*?(<!--\\s*${name}_END\\s*-->)`,
    'g'
  );
  return html.replace(re, `$1\n${content}\n        $2`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function estimateReadMin(text) {
  const words = text.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.round(words / 400));
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── fetchers ───────────────────────────────────────────────────────────────

async function fetchRSS(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': `zawato-site-builder/1.0` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  return res.text();
}

async function fetchTotalArticleCount(blogBase) {
  try {
    const res = await fetch(`${blogBase}/wp-json/wp/v2/posts?per_page=1&status=publish`, {
      headers: { 'User-Agent': `zawato-site-builder/1.0` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const total = parseInt(res.headers.get('X-WP-Total') || '0', 10);
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

function parseRSSItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
      const mm = r.exec(block);
      return mm ? mm[1].trim() : '';
    };
    const enclosureUrl = (() => {
      const er = /<enclosure[^>]+url="([^"]+)"[^>]*>/i.exec(block);
      return er ? er[1] : '';
    })();
    const mediaUrl = (() => {
      const mr = /<media:thumbnail[^>]+url="([^"]+)"[^>]*>/i.exec(block)
               || /<media:content[^>]+url="([^"]+)"[^>]*>/i.exec(block);
      return mr ? mr[1] : '';
    })();
    items.push({
      title:   get('title'),
      link:    get('link'),
      pubDate: get('pubDate'),
      desc:    get('description'),
      thumb:   mediaUrl || enclosureUrl,
    });
  }
  return items;
}

function countRSSItems(xml) {
  return (xml.match(/<item>/g) || []).length;
}

async function fetchGitHubRepos(user) {
  const headers = { 'User-Agent': `zawato-site-builder/1.0`, Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(
    `${GITHUB_API_BASE}/users/${user}/repos?sort=pushed&per_page=100&type=public`,
    { headers, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`GitHub API failed: ${res.status}`);
  return res.json();
}

// ── HTML builders ──────────────────────────────────────────────────────────

function buildLatestPostsHTML(items) {
  return items.slice(0, 3).map(item => {
    const readMin = estimateReadMin(item.desc);
    const date    = formatDate(item.pubDate);
    const thumb   = item.thumb
      ? `<img class="post-card-thumb" src="${escapeHtml(item.thumb)}" alt="" loading="lazy" decoding="async">`
      : '';
    return `<a href="${escapeHtml(item.link)}" class="post-card" target="_blank" rel="noopener">
          ${thumb}
          <div class="post-card-body">
            <p class="post-card-title">${escapeHtml(item.title)}</p>
            <span class="post-card-meta">
              <i class="fas fa-calendar-alt"></i>
              <span class="post-card-date">${escapeHtml(date)}</span>
              <span class="post-card-read">${readMin} min</span>
            </span>
          </div>
        </a>`;
  }).join('\n        ');
}

function buildStatsHTML(articleCount, repoCount) {
  return `<div class="stat-card">
        <div class="stat-icon"><i class="fas fa-pen-nib"></i></div>
        <div class="stat-value" data-target="${articleCount}">${articleCount}</div>
        <div class="stat-label">記事</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fab fa-github"></i></div>
        <div class="stat-value" data-target="${repoCount}">${repoCount}</div>
        <div class="stat-label">リポジトリ</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-star"></i></div>
        <div class="stat-value" data-target="5">5</div>
        <div class="stat-label">年の経験</div>
      </div>`;
}

function buildTopReposHTML(repos) {
  const top = repos
    .filter(r => !r.fork && r.description)
    .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
    .slice(0, 3);

  if (!top.length) {
    return `<a href="https://github.com/${GITHUB_USER}" class="link-card" target="_blank" rel="noopener me">
          <div class="link-icon"><i class="fab fa-github"></i></div>
          <div class="link-content">
            <h3 class="link-title">GitHub</h3>
            <p class="link-description">すべてのリポジトリを見る</p>
          </div>
          <div class="link-arrow"><i class="fas fa-chevron-right"></i></div>
        </a>`;
  }

  return top.map(r => {
    const lang = r.language ? `<span><i class="fas fa-circle" style="font-size:0.6rem;color:var(--link)"></i> ${escapeHtml(r.language)}</span>` : '';
    const stars = r.stargazers_count > 0
      ? `<span><i class="fas fa-star"></i> ${r.stargazers_count}</span>`
      : '';
    return `<a href="${escapeHtml(r.html_url)}" class="repo-card" target="_blank" rel="noopener">
          <p class="repo-card-name"><i class="fab fa-github"></i> ${escapeHtml(r.name)}</p>
          <p class="repo-card-desc">${escapeHtml(r.description || '')}</p>
          <div class="repo-card-meta">${lang}${stars}</div>
        </a>`;
  }).join('\n        ');
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  let html = readFileSync(INDEX_PATH, 'utf8');
  const originalHtml = html;

  // --- RSS ---
  let rssXml = null;
  try {
    rssXml = await fetchRSS(BLOG_RSS_URL);
    console.log('✓ RSS fetched');
  } catch (e) {
    console.warn(`⚠ RSS fetch failed (${e.message}), skipping LATEST_POSTS + article count`);
  }

  // --- GitHub ---
  let repos = null;
  try {
    repos = await fetchGitHubRepos(GITHUB_USER);
    console.log(`✓ GitHub repos fetched (${repos.length})`);
  } catch (e) {
    console.warn(`⚠ GitHub API failed (${e.message}), skipping repos + repo count`);
  }

  // --- LATEST_POSTS ---
  if (rssXml) {
    const items = parseRSSItems(rssXml);
    if (items.length) {
      html = replaceMarker(html, 'LATEST_POSTS', buildLatestPostsHTML(items));
    }
  }

  // --- STATS ---
  let articleCount = await fetchTotalArticleCount(BLOG_BASE);
  if (articleCount === null && rssXml) {
    // fallback: RSS item count (max feed page size, typically 10)
    articleCount = countRSSItems(rssXml);
  }
  const repoCount = repos ? repos.filter(r => !r.fork).length : null;
  if (articleCount !== null || repoCount !== null) {
    // 既存の data-target から現在値を取るフォールバック
    const getExisting = (label) => {
      const re = new RegExp(`data-target="(\\d+)"[^<]*<\\/div>\\s*<div class="stat-label">${label}<`);
      const m = re.exec(html);
      return m ? parseInt(m[1], 10) : 0;
    };
    const a = articleCount ?? getExisting('記事');
    const r = repoCount    ?? getExisting('リポジトリ');
    html = replaceMarker(html, 'STATS', buildStatsHTML(a, r));
  }

  // --- TOP_REPOS ---
  if (repos) {
    html = replaceMarker(html, 'TOP_REPOS', buildTopReposHTML(repos));
  }

  if (html === originalHtml) {
    console.log('No changes.');
    return;
  }

  writeFileSync(INDEX_PATH, html, 'utf8');
  console.log('✓ index.html updated');
}

main().catch(e => { console.error(e); process.exit(1); });
