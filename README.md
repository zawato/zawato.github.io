# zawato.github.io

個人ブログ [zawato.jp](https://zawato.jp) への導線ハブ兼ポートフォリオサイト。

GitHub Actions が毎日 zawato.jp の RSS と GitHub API から最新記事・リポジトリ情報を取得し、`index.html` を自動更新する。
手動更新は `Actions > Update Site Content > Run workflow` から実行できる。

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
