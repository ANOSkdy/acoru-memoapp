# acoru-memoapp DESIGN.md (PR1)

このドキュメントは **acoru-memoapp の新ブランド向け UI 設計原本** です。PR1 では全画面の置換は行わず、トークン・基盤 CSS・シェルの最小整合を定義します。

## 1) Visual Theme & Atmosphere

### ブランド方針
- キーワード: **Calm Focus / Structured Clarity / Quiet Confidence**
- 想定利用シーン: 長時間のメモ整理・編集・ナビゲーション
- 体験目標:
  - 文章可読性を最優先
  - ナビゲーションは視線移動が少ない密度
  - インタラクションは「静かな反応」を基調に過剰な装飾を避ける

### トーン
- コントラストは十分確保しつつ、背景は寒色寄りニュートラルで目の疲れを軽減
- 主要アクションは鮮やかな青緑系のアクセントで一貫表示
- 成功/警告/危険は情報優先で明確に分離

---

## 2) Color Palette & Roles

### Brand Palette
- **Primary**: `#0B7A75`（Acoru Teal）
- Primary hover: `#096560`
- Primary soft/bg: `#E4F5F3`
- Primary ring: `#39B6AD`

### Neutral Palette
- Background: `#F3F6F9`
- Surface: `#FFFFFF`
- Surface muted: `#ECF1F5`
- Surface elevated: `#FFFFFF`
- Border subtle: `#D7E0E8`
- Border strong: `#B8C6D3`
- Text strong: `#16202A`
- Text muted: `#5E7082`
- Text disabled: `#8EA0B2`

### Semantic Palette
- Success: `#1F9D68` / soft `#E7F7EF`
- Warning: `#B7791F` / soft `#FFF4E5`
- Danger: `#C53A50` / soft `#FDECF0`
- Info: `#2E6FD8` / soft `#EAF1FF`

### ロール定義
- `--color-bg`: ページ背景
- `--color-surface`: カード、フォーム、モーダル
- `--color-surface-muted`: サブパネル、補助ボタン背景
- `--color-text`: 見出し・本文
- `--color-text-muted`: 補足、メタ情報
- `--color-border`: 標準ボーダー
- `--color-primary`: 主導 CTA
- `--color-focus-ring`: キーボードフォーカス

---

## 3) Typography Rules

### フォント
- UI Font: `Inter, "Noto Sans JP", system-ui, -apple-system, sans-serif`
- Monospace: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

### スケール
- Display: 32 / 1.2 / 700
- H1: 28 / 1.3 / 700
- H2: 22 / 1.35 / 650
- H3: 18 / 1.4 / 600
- Body L: 16 / 1.7 / 450
- Body M: 14 / 1.6 / 450
- Caption: 12 / 1.5 / 500

### ルール
- 長文は 16px 以上、行間 1.6 以上
- フォーム・ボタンは 14px 以上
- 英数字のみの情報は letter-spacing を軽く抑制（0〜0.01em）

---

## 4) Spacing / Radius / Shadow scales

### Spacing（4px grid）
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px

### Radius
- `--radius-xs`: 6px
- `--radius-sm`: 10px
- `--radius-md`: 14px
- `--radius-lg`: 20px
- `--radius-pill`: 999px

### Shadow
- `--shadow-sm`: `0 1px 2px rgba(15, 23, 42, 0.06)`
- `--shadow-md`: `0 12px 28px rgba(15, 23, 42, 0.10)`
- `--shadow-lg`: `0 24px 54px rgba(15, 23, 42, 0.14)`

---

## 5) Layout Principles

- App shell は「ヘッダー固定 + コンテンツ可変」を維持
- 最大幅を制限せず、情報密度の高い編集 UI を優先
- モバイルはタップしやすさ優先（最小 44px）
- デスクトップでの主要編集エリアは余白を確保しつつ横幅を活用

---

## 6) Component Stylings

### Button
- Solid: Primary 背景 + 白文字
- Ghost: Surface 背景 + 標準ボーダー
- Danger: Danger 背景 + 白文字
- Plain: 無彩色テキスト主体
- すべて min-height 44px（compact 系を除く）

### Input / Textarea / Select
- 背景は surface、境界は subtle border
- focus 時: border を primary 系へ + ring 表示
- placeholder は muted text

### Card / Panel
- Surface 背景 + subtle border + `shadow-sm`
- 高階層モーダルは `shadow-md` 以上

### Navigation
- hover: surface-muted
- active: primary soft 背景 + primary 文字

### Feedback
- success/warning/danger は soft 背景 + role border

---

## 7) Interaction States

- Hover: 色変化は 120–180ms
- Active: 軽微な押下感（暗度上昇）
- Focus-visible: 2px ring + 2px offset
- Disabled: 50〜70% opacity + pointer 抑制
- Loading: 既存ロジックを維持し、状態文言の視認性を担保

---

## 8) Responsive Behavior

- Breakpoint 基準
  - mobile: < 960px
  - desktop: >= 960px
- モバイルでは drawer 導線を維持
- デスクトップでは notes 2 カラム構成を維持
- 文字サイズは固定、余白と配置で適応（可読性優先）

---

## 9) Do’s and Don’ts

### Do
- トークンを直接使用し、ハードコード色を避ける
- 視認性の高い focus を必ず維持する
- 新規 UI はまず `button/card/input` 系の既存基盤クラスを使う
- 長文の line-height は 1.6 以上を維持する

### Don’t
- ページ単位で独自色を乱立させない
- 影を過剰に重ねない
- 文字サイズ 12px 未満を通常 UI で使わない
- PR1 で機能導線や URL 構造を変更しない

---

## 10) Agent Prompt Guide

将来の UI 実装エージェントは以下を必ず守る:

1. 変更前にこの `docs/design/DESIGN.md` を参照し、トークンを優先使用する。
2. 新規コンポーネントにハードコード色を入れる場合は理由をコメントする。
3. 画面全面刷新を行う場合も、機能階層・URL・主要導線は維持する。
4. focus-visible、コントラスト、最小タップ領域を壊さない。
5. PR1 範囲では共通基盤に集中し、詳細な画面再設計は PR2 へ分離する。

---

## 11) PR1 Scope Note

- このドキュメント作成
- `app/globals.css` のトークン再定義・基盤スタイル更新
- 必要最小限の app shell 見た目調整
- 既存機能ロジック・ルート・データフローは変更しない
