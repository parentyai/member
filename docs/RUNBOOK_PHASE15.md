# Phase15 Runbook (Admin Access)

## 1. 対象範囲
- 対象: /admin/ops, /admin/review, /admin/read-model, /admin/implementation-targets
- 非対象: エンドユーザーUI、LINE、MiniApp（撤回済み）

## 2. 認証前提（事実）
- Cloud Run IAM 認証必須
- 未認証アクセス時は 403
- ブラウザ単体では到達不可

## 3. 正常アクセス手順（人間用）
1) gcloud ログイン
   - `gcloud auth login`
2) IDトークン取得
   - `TOKEN=$(gcloud auth print-identity-token)`
3) 認証付きアクセス例
   - `/admin/ops`
     - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/ops`
   - `/admin/review`
     - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/review`
   - `/admin/read-model`
     - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/read-model`
   - `/admin/implementation-targets`
     - `curl -i -H "Authorization: Bearer $TOKEN" https://member-pvxgenwkba-ue.a.run.app/admin/implementation-targets`

## 4. 禁止事項
- トークン共有禁止
- スクリーンショットの外部共有禁止
- URL直叩きの常用禁止

## 5. 監査ログの残し方
- 実行日時
- 実行者
- 対象URL
- 結果（200/403）
- 判定（PASS/FAIL）
