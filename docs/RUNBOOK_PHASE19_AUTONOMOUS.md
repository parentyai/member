# Phase19 自律実行 Runbook（WIP）

## 目的
- 自律実行ループ（test → verify → record）を人間の判断なしで再現可能にする

## 実行コマンド（コピペ）
```bash
BASE_URL="https://member-xxxxx-ue.a.run.app" \
LINE_USER_ID="Uxxxxxxxx" \
LINK_URL="https://example.com" \
SA="member-deploy@PROJECT.iam.gserviceaccount.com" \
bash scripts/phase19_autonomous_loop.sh
```

## 入力（env一覧）
- BASE_URL（必須）
- LINE_USER_ID（必須）
- LINK_URL（任意、未指定時は https://example.com）
- SA（任意、impersonate用）

## 期待結果（YES/NO）
- linkRegistryId / notificationId / deliveryId が出力される → YES
- click の HTTP 302 が出力される → YES
- next_logs_filter が出力される → YES

## 失敗時の分岐
- token 取得失敗 → gcloud auth login / SA権限を確認
- 4xx → 入力値（LINE_USER_ID / linkRegistryId / notificationId）を確認
- 5xx → Cloud Run logs で [OBS] 行を確認
- LINE未着 → [OBS] action=test-send の result を確認
- click 400 → deliveryId / linkRegistryId の一致を確認

## 禁止事項
- 勝手な本番大量送信
- 既存挙動の変更
- フラグなしで実験コードを走らせる
