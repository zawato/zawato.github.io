/**
 * _utils.mjs — 共通ユーティリティ
 */

export function replaceMarker(html, name, content) {
  const re = new RegExp(
    `(<!--\\s*${name}_START\\s*-->)[\\s\\S]*?(<!--\\s*${name}_END\\s*-->)`,
    'g'
  );
  return html.replace(re, `$1\n${content}\n        $2`);
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function estimateReadMin(text) {
  const words = text.replace(/<[^>]*>/g, '').length;
  return Math.max(1, Math.round(words / 400));
}

export function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
