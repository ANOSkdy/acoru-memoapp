# acoru-memoapp

Next.js + TypeScript + Neon の最小構成です。Vercel デプロイを前提にしています。

## セットアップ

```bash
pnpm install
```

## 開発サーバー

```bash
pnpm dev
```

## 環境変数

`.env` はローカル専用で、Vercel では環境変数として登録してください。

```
DATABASE_URL=postgres://user:password@host.neon.tech/neondb?sslmode=require
```

## ユーザー作成

初期ユーザーはスクリプトで作成します。

```bash
pnpm user:create -- --email you@example.com --password "your-password"
```

## Neon 動作確認

`/` にアクセスすると `select now()` の結果を表示します。`DATABASE_URL` が未設定の場合は案内メッセージを出します。

## Vercel デプロイ

GitHub リポジトリを Vercel に接続し、環境変数 `DATABASE_URL` を設定してください。
