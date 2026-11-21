# zawato.github.io

zawato のポートフォリオ。トップ（`index.html`＋`css/portfolio.css`）は1ページで、プロフィール・資格・作品を一望させる。

トップは手書きの静的HTMLで、自動更新はしない（2026-11-21 に毎日の RSS・GitHub API 取得をやめた）。作品の説明やブログの外観画像（`images/blog-top.jpg`）は手で更新する。

## コンテンツページの追加方法

Obsidian vault の `zawato/github_pages/<topic>/index.md` に記事を書き、ローカルでビルドして commit/push する。

### フロントマター

```yaml
---
title: ページタイトル
description: 概要文
tags: [tag1, tag2]
updated: 2026-05-17
draft: false
---
```

### ビルドコマンド

```bash
npm install           # 初回のみ
node scripts/build-pages.mjs
```

### 公開フロー

1. `zawato/github_pages/<topic>/index.md` を執筆
2. `node scripts/build-pages.mjs` でビルド（`<topic>/index.html`, `contents/index.html`, `sitemap.xml` が更新される）
3. git commit & push → `https://zawato.github.io/<topic>/` で公開
