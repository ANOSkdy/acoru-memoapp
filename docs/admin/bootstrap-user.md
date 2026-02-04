# 管理者向け: Bootstrap User エンドポイント

一時的な管理者ブートストラップ用に、`POST /api/admin/bootstrap-user` を用意しています。
**`BOOTSTRAP_TOKEN` を設定している間だけ有効**で、トークンを削除すると無効化されます。

## 手順 (Vercel)

1. 対象環境 (Preview / Production) の Vercel 環境変数に以下を設定
   - `BOOTSTRAP_TOKEN` (必須)
   - `ALLOW_BOOTSTRAP_IN_PROD=1` (Production でのみ必要)
2. 再デプロイ
3. 一度だけエンドポイントを実行
4. `BOOTSTRAP_TOKEN` を削除して再デプロイし、無効化

> **注意:** Production では `ALLOW_BOOTSTRAP_IN_PROD=1` がない限り拒否されます。

## cURL 例

```bash
curl -X POST "https://<your-app-domain>/api/admin/bootstrap-user" \
  -H "Authorization: Bearer <BOOTSTRAP_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "<strong-password>",
    "name": "Admin",
    "displayName": "Admin"
  }'
```

- `email` は小文字化・trim されます
- `displayName` が空の場合は `email` のローカルパートが使われます
- 応答は `{ ok: true, userId, workspaceId }` のみを返し、パスワードやハッシュは返しません
