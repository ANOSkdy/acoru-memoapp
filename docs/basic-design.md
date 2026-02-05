# 基本設計書（シンプルNotion風メモアプリ）

更新日: 2026-02-04  
対象: MVP〜V1（アクティブユーザー ≈ 50名）  
前提: Vercel / Next.js(App Router) + TypeScript / Node Runtime / Neon(Postgres) / Gemini API（Gemini 3 Flash）

---

## 1. 本書の位置づけ

本書は、先に整理した「システムデザイン仕様書」を実装可能な粒度へ落とし込んだ**基本設計（アーキテクチャ / モジュール / API / DB / 運用）**の合意ドキュメントである。  
MVPでは「書く・探す・整理する」を最短距離で成立させ、Notion級のDB/共有/通知は後段に回す。

---

## 2. スコープ

### 2.1 MVP対象（必須）

- 認証（個人アカウント）
- ページ（メモ）CRUD
- ブロック編集（最小ブロックセット）
- タグ / お気に入り / フォルダ（またはページツリー）
- グローバル検索（タイトル＋本文）
- ゴミ箱（復元 / 完全削除）
- 軽量履歴（スナップショット）
- AI（Gemini 3 Flash）による支援：タイトル提案 / 要約 / タグ提案
- モバイル最適化（レスポンシブ＋タッチ前提）

### 2.2 対象外（MVPではやらない）

- 高度DB（ビュー切替、リレーション、式）
- コメント / メンション / 通知ハブ
- リアルタイム共同編集（OT/CRDT）
- 高度なテンプレート機構・マーケット

---

## 3. 非機能要件（初期規模に合わせた設計）

### 3.1 パフォーマンス目標

- 一覧（最近/すべて/お気に入り）初期表示: 体感 300ms〜1.0s程度（ネットワーク依存）
- 検索: 1秒以内（最初は簡易検索→FTSへ段階移行可能）
- 編集: 入力遅延が体感できない（ローカル反映→遅延同期）

### 3.2 可用性 / 信頼性

- ゴミ箱＋スナップショットで誤操作復旧可能
- 例外時もページ破損を避ける（整合性のある保存単位を定義）

### 3.3 セキュリティ

- 秘密情報（DB/Gemini APIキー）はサーバー専用環境変数のみ
- ルート/サーバーアクションで認可、クライアント直DBは禁止

---

## 4. 技術スタック（確定）

### 4.1 フロント/サーバー

- Next.js（App Router）+ TypeScript
- Runtime: Node（Edgeは使用しない／必要時のみ明示）

### 4.2 デプロイ/環境

- Vercel（Production / Preview / Development）
- Vercel標準環境は Local / Preview / Production の3種として扱う（運用上 “Development” はローカル相当）
- VERCEL_ENV は production | preview | development を取り得る

### 4.3 DB

- Neon Postgres
- サーバーレス環境（Vercel）での接続は、Neonが推奨する Neon Serverless Driver を優先（HTTP/WSの選択含む）
- Vercel×Neon統合を用いる場合、PreviewごとにDBブランチを自動作成＋環境変数を注入できる

### 4.4 AI

- Gemini API（Gemini 3 Flash）
- モデルID（Preview）: gemini-3-flash-preview
- JS/TSは Google GenAI SDK（@google/genai）を推奨（Node.js v18+）
- thinking_level で低レイテンシ指向（low）を選択可能

---

## 5. 全体アーキテクチャ

### 5.1 論理構成

- Web App（Next.js）
  - UI（RSC + Client Components）
  - Server Actions / Route Handlers（Node runtime）
- DB（Neon Postgres）
  - ページ / ブロック / タグ / 履歴
  - 全文検索（段階導入）
- AI（Gemini API）
  - 要約、タイトル提案、タグ提案（ユーザー明示操作 or 設定で自動）
- ファイルストレージ（任意）
  - 画像アップロードが必要な場合、Vercelと相性の良いオブジェクトストレージを利用（将来差し替え可能な抽象化）

### 5.2 コンポーネント図（概念）

```mermaid
flowchart LR
  U[User (Mobile/Desktop)] -->|HTTPS| V[Vercel: Next.js App Router (Node)]
  V -->|SQL| N[(Neon Postgres)]
  V -->|HTTPS| G[Gemini API: gemini-3-flash-preview]
  V -->|optional| S[Object Storage (Images)]
```

---

## 6. デプロイ設計（Vercel）

### 6.1 ブランチ戦略

- main → Production
- feature branch / PR → Preview
- local → Development（.env.local / vercel env pull）

Vercelでは、Productionは通常 main へのpushで作られ、PreviewはProduction Branch以外へのpushで作られる。

### 6.2 環境変数

必須（サーバー専用）

- DATABASE_URL（推奨: pooled）
- DATABASE_URL_UNPOOLED（マイグレーション/ツール用）
- GEMINI_API_KEY（Gemini APIキー）

Neon×Vercel統合では DATABASE_URL / DATABASE_URL_UNPOOLED 等が注入され、Previewではデプロイ単位で動的に注入される。

Vercel環境の使い分け

- Production: 本番DB（Neon main / prod branch）
- Preview: PreviewごとのNeon branch（推奨）
- Development: vercel dev またはローカル用DB

> 補足：Preview DB branchを採用することで、PRごとにスキーマ変更・テストデータを安全に隔離できる

### 6.3 マイグレーション（推奨）

- Preview/Production の build 時にマイグレーション適用（破壊的変更は段階リリース）
- NeonのVercel統合ドキュメントでも build コマンドに migration を入れる運用が示されている

---

## 7. 画面設計（MVP）

### 7.1 画面一覧（MVP）

- S-01: サインイン
- S-02: ホーム（最近）
- S-03: すべてのメモ
- S-04: エディタ（ページ）
- S-05: 検索/コマンドパレット（Cmd/Ctrl+K）
- S-06: タグ管理
- S-07: お気に入り
- S-08: ゴミ箱
- S-09: 設定

### 7.2 レスポンシブ/モバイル最適化方針（必須）

基本原則

- 情報密度を落とし、操作面積を増やす（タップ領域 44px 目安）
- 主要導線は「片手操作」で成立させる

レイアウト

Desktop

- 左: サイドバー（固定）
- 中央: 一覧/エディタ
- 右: メタ（タグ/履歴）※MVPは省略可

Mobile

- サイドバーはドロワー（ハンバーガー）
- 下部に簡易ナビ（最近/検索/新規/設定）を検討
- エディタは全画面、戻るで一覧

入力体験（モバイル）

- エディタのツールバーはソフトキーボード上に追従（iOS/Android差異を吸収）
- / コマンドはモバイルでは “＋” ボタンでも起動可能にする

---

## 8. 編集機能（ブロック設計）

### 8.1 ブロック種別（MVP固定）

- paragraph
- heading（h1/h2/h3）
- bulleted_list
- numbered_list
- todo
- toggle
- quote
- divider
- callout
- image

### 8.2 保存単位（整合性）

- ページ単位でブロック配列を保存（MVPは差分最適化しない）
  - メリット: 実装が単純、破損しにくい
  - デメリット: 更新頻度が高い（対策: デバウンス + バッチ）

---

## 9. データ設計（Neon Postgres）

### 9.1 エンティティと責務

- users: 認証主体
- workspaces: 将来のマルチワークスペース拡張点（MVPは1固定可）
- pages: メモ本体（タイトル、階層、削除/お気に入り）
- blocks: ページ内容（JSONB）
- page_revisions: スナップショット履歴（軽量）

### 9.2 テーブル定義（論理）

pages

- id (uuid)
- workspace_id (uuid)
- parent_page_id (uuid|null)（フォルダ/階層）
- title (text)
- icon (text|null)
- cover_url (text|null)
- is_favorite (bool)
- is_deleted (bool)
- deleted_at (timestamptz|null)
- created_at, updated_at (timestamptz)
- last_opened_at (timestamptz|null)（最近の根拠）

blocks

- id (uuid)
- page_id (uuid)
- type (text)（enum相当）
- content (jsonb)
- order_index (int)
- created_at, updated_at

page_revisions

- id (uuid)
- page_id (uuid)
- snapshot (jsonb)（title + blocks 等）
- created_at
- created_by (uuid)

### 9.3 インデックス設計（MVP）

- pages(workspace_id, updated_at desc)
- pages(workspace_id, is_favorite, updated_at desc)
- blocks(page_id, order_index)

### 9.4 検索（段階導入）

- MVP（早期）: title ILIKE + 代表本文（blocksから抽出したテキスト）を ILIKE
- V1: Postgres全文検索（tsvector + GIN）
  - pages.search_text（生成カラム or 更新時に再生成）
  - to_tsvector('simple', search_text) など

---

## 10. API設計（Next.js Route Handlers / Server Actions）

> 方針: DBアクセスはServer Actions / Route Handlersに閉じ、クライアントはJSON/Action経由のみ。

### 10.1 ルーティング方針

- 読み取り系: GET /api/...
- 書き込み系:
  - UI直結の更新 → Server Actions（CSRF/認可が簡単）
  - 外部連携/将来API公開 → Route Handlers

### 10.2 エンドポイント一覧（MVP）

Pages

- GET /api/pages?scope=recent|all|favorites&parentId=
- POST /api/pages
- GET /api/pages/:id
- PATCH /api/pages/:id
- POST /api/pages/:id/restore
- DELETE /api/pages/:id（完全削除）

Blocks

- GET /api/pages/:id/blocks
- PUT /api/pages/:id/blocks（一括置換）

Search

- GET /api/search?q=...

Revisions

- GET /api/pages/:id/revisions
- POST /api/pages/:id/revisions（手動スナップショット）

AI

- POST /api/ai/title-suggest
- POST /api/ai/summarize

### 10.3 共通レスポンス（例）

- 成功: { ok: true, data: ... }
- エラー: { ok: false, error: { code, message } }
- バリデーションエラー: { ok: false, error: { code: "VALIDATION", fields: {...} } }

---

## 11. 認証・認可設計

### 11.1 MVPの前提

- 個人利用（ワークスペース = 自分）
- ただし DBは workspace_id/user_id を必ず持ち、将来の共有に備える

### 11.2 認可の原則

- すべてのDBクエリに workspace_id = session.workspaceId を付与
- URL直叩き（/api/pages/:id）でも同様

---

## 12. AI設計（Gemini 3 Flash）

### 12.1 利用方針

- AIは任意機能（ユーザー操作で起動、または設定で自動）
- 送信データ最小化（ページ全量ではなく、必要な抜粋）
- 生成結果は「提案」として扱い、ユーザーが確定するまで永続化しない（推奨）

### 12.2 モデル/SDK

- モデル: gemini-3-flash-preview
- Node/TS: npm install @google/genai（Node v18+）
- 低レイテンシ用途は thinking_level: low を標準（要約は high も選択可）

### 12.3 Gemini API呼び出し方式

- SDK優先（保守性）
- 代替: REST（generativelanguage.googleapis.com/v1beta/...:generateContent）

### 12.4 AI機能別仕様（MVP）

A) タイトル提案

- 入力: 本文先頭Nブロック（テキスト抽出）
- 出力: 3案（短い、説明的、ユーモア等）
- thinking_level: low

B) 要約

- 入力: テキスト抽出（最大X文字/トークン）
- 出力: 3〜5行サマリ + 箇条書き要点
- thinking_level: high（任意）

C) タグ提案

- 入力: タイトル＋要点（本文全量ではなくサマリでも可）
- 出力: 既存タグから候補 + 新規タグ案
- “新規タグ”は自動作成しない（提案→ユーザー確定）

### 12.5 構造化出力（推奨）

JSON schema（例）

- title-suggest: { suggestions: string[] }
- summarize: { summary: string, bullets: string[] }

失敗時はフォールバック（プレーンテキスト）→サーバー側で整形

---

## 13. DB接続設計（Neon）

### 13.1 接続方式

- Vercelのようなサーバーレス×JS/TSでは Neon Serverless Driver 推奨
- クエリは原則「短命・一撃（one-shot）」で完結させる（N+1を避ける）

### 13.2 プレビュー環境のDB分離（推奨）

- Neon×Vercel統合により Preview deployment ごとに DB branch を自動作成し、接続文字列をデプロイ単位で注入
- Migration は build に組み込み（Previewでもスキーマが揃う）

---

## 14. セキュリティ設計

### 14.1 秘密情報

- Gemini APIキーは GEMINI_API_KEY（サーバーのみ）
- DB接続は DATABASE_URL（サーバーのみ）
- NEXT_PUBLIC_ で始まる変数に秘密情報を入れない（レビュー項目化）

### 14.2 入力バリデーション

- API/Action境界でZod等により検証
- ブロックcontentは型ごとに許可フィールドを制限（任意キーを弾く）

### 14.3 XSS/コンテンツ安全

- リッチテキストはHTMLを保存しない（JSON構造を保存）
- レンダリング時は安全なレンダラを使用（dangerouslySetInnerHTML回避）

### 14.4 レート制御（初期でも必須）

- AI系エンドポイントはユーザー単位で秒間/分間制限（例: 10req/min）
- 検索も過剰連打を抑制（デバウンス＋サーバー側で軽い制限）

---

## 15. 観測性（ログ/監視）

### 15.1 ログ

- サーバーログ: requestId / userId / route / latency / error code
- 機微情報（APIキー、DB URL、本文全量）はログ出力禁止

### 15.2 エラー監視

- 例外監視（Sentry等）導入を推奨
- AI失敗は “失敗” を正常系として扱えるように（提案機能なので）

---

## 16. テスト方針（MVP）

- Unit: ブロック変換/抽出、検索クエリ生成、AIレスポンス整形
- Integration: API（pages/search）の認可・整合性
- E2E（最小）:
  - 新規メモ作成→保存→検索→表示
  - ゴミ箱→復元
  - モバイル幅での操作（Playwrightでviewport）

---

## 17. UIデザイン仕様（実装トークン）

### 17.1 カラーパレット（固定）

- ベース: #F9F9F9
- プライマリ: #4A90E2
- セカンダリ: #50E3C2
- アクセント-1: #FFD166
- アクセント-2: #F25F5C
- アクセント-3: #9D59EC

### 17.2 アイコン/イラスト/影/アニメーション

- アイコン: 2px線画 + 塗りつぶし
- シャドウ: 柔らかいドロップシャドウ（カード/浮遊UI）
- アニメ: 120–200ms の控えめトランジション

---

## 18. MVP実装マイルストーン（推奨順）

1. 認証 + pages CRUD + sidebar/一覧
2. blocks（最小）+ 自動保存（デバウンス）
3. 検索（簡易）+ Cmd/Ctrl+K
4. タグ/お気に入り + フィルタ
5. ゴミ箱 + 復元 + 完全削除
6. スナップショット履歴（自動/手動）
7. AI（タイトル/要約/タグ提案）
8. FTS導入 + 速度改善
9. 画像アップロード（ストレージ抽象化）

---

## 参考（公式/一次情報）

- Vercel Environments / Env Vars（Production/Preview/Development の定義、適用ルール、VERCEL_ENV）
- Neon（サーバーレス環境での推奨ドライバ、Vercel統合のpreview branch/環境変数注入）
- Gemini API（Gemini 3 Flash model id、SDK導入、JS実装例、thinking_level）
