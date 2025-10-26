# Nostr Profile SVG API

NostrプロフィールをSVG形式で取得できるAPIサービスです。Cloudflare
Workers上で動作し、Nostrリレーからユーザープロフィールとバッジ情報を取得してSVGカードを生成します。

![Demo](https://nostr-embed.odango.app/npub1r0hvae2ld84u9zgyqdsx7294ar4m4v3ayfnnpcftf0mk955ay93qejel3w)

## 機能

- Nostr npub, nprofileからプロフィール情報を取得
- アバター、表示名、ユーザー名、自己紹介を含むSVGカードを生成
- プロフィールバッジの表示（最大5個）
- 1時間のキャッシュでパフォーマンスを最適化
- Cloudflare Workersで高速レスポンス

## 使い方

### API エンドポイント

#### プロフィール情報の取得

```
GET /:npub
```

**パラメータ:**

- `npub` - Nostrの公開鍵（npub1で始まる文字列）

**レスポンス:**

- Content-Type: `image/svg+xml`
- SVG形式のプロフィールカード（650x200px）

**例:**

```
https://nostr-embed.odango.app/npub1r0hvae2ld84u9zgyqdsx7294ar4m4v3ayfnnpcftf0mk955ay93qejel3w
```

#### API情報の取得

```
GET /
```

APIの基本情報とバージョンを返します。

### HTMLに埋め込む

```html
<img src="https://nostr-embed.odango.app/npub1..." alt="Nostr Profile" />
```

## 開発

### セットアップ

```bash
# 依存関係のインストール
bun install

# 開発サーバーの起動
bun run dev
```

### テスト

```bash
# ローカルでテスト
curl http://localhost:52373/npub1r0hvae2ld84u9zgyqdsx7294ar4m4v3ayfnnpcftf0mk955ay93qejel3w
```

## デプロイ

Cloudflare Workersにデプロイするには：

```bash
wrangler deploy
```

デプロイ設定は `wrangler.jsonc` で管理されています。

## 技術スタック

- **Runtime**: Cloudflare Workers
- **Framework**: [Elysia](https://elysiajs.com/)
- **Nostr**: [nostr-tools](https://github.com/nbd-wtf/nostr-tools) v2.17.0
- **Language**: TypeScript

### デフォルトリレー

nprofileを入力した場合は、その中に含まれるリレーを優先的に使用します。npubのみの場合は以下のデフォルトリレーを使用します。

- wss://yabu.me
- wss://relay.damus.io
- wss://relay.nostr.band

## アーキテクチャ

### コンポーネント

- **src/index.ts** - メインのElysiaアプリケーションとルーティング
- **src/nostr.ts** - Nostrリレーとの通信、プロフィールとバッジの取得
- **src/svg.ts** - SVGプロフィールカードの生成

### 主な設計パターン

- **並列フェッチ**: プロフィールとバッジを同時取得してパフォーマンスを向上
- **タイムアウト保護**: すべてのリレー操作に10秒のタイムアウトを設定
- **リソースクリーンアップ**: SimplePoolを適切にクローズしてリソースリークを防止
- **キャッシング**: 1時間のCache-Controlヘッダーでレスポンスをキャッシュ

## ライセンス

MIT
