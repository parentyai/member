# CATCHUP_W4_DESIGN_READINESS_CHECKLIST

4週間キャッチアップ W4（デザイン着手準備）の固定チェックリスト。
目的は、Admin UI の見た目改善を開始しても運用契約を壊さないこと。

更新日: 2026-02-25

## 1. Scope
- 対象:
  - Admin UI の情報設計在庫確認
  - UI辞書契約 / ナビ契約 / モバイル表示観点の固定
  - stg 固定順 E2E の証跡確認
- 対象外:
  - 新機能本体の追加
  - API意味変更 / スキーマ変更
  - 既存ガード緩和

## 2. Entry Criteria (着手条件)
- `npm run test:docs` PASS
- `npm run test:admin-nav-contract` PASS
- `npm run catchup:drift-check` PASS
- `npm run firestore-indexes:check -- --contracts-only` PASS

## 3. IA Inventory (固定参照)
- `apps/admin/app.html`
- `apps/admin/admin.css`
- `apps/admin/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/SSOT_ADMIN_UI_OS.md`
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md`

## 4. Design Readiness Checklist
1. 辞書契約:
- UI表示文言の変更対象が `docs/ADMIN_UI_DICTIONARY_JA.md` と一致している
- `npm run test:docs` が PASS

2. ナビ契約:
- ロール別導線が `test:admin-nav-contract` で維持される
- `ENABLE_ADMIN_NAV_ROLLOUT_V1` / `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1` の退避手順を保持

3. モバイル表示:
- 主要ペイン（home/users/composer/city-packs/maintenance）で 360px 幅確認を実施
- スクロール崩れ・操作不能がないことを手動確認する

4. 運用境界:
- admin write は confirm token（planHash + confirmToken）必須を維持
- internal jobs は token guard（CITY_PACK_JOB_TOKEN / JOURNEY_JOB_TOKEN）必須を維持

5. stg固定順E2E:
- `.github/workflows/stg-notification-e2e.yml` で fixed-order を実行
- `stg fixed-order E2E` を必須ゲートとして扱う
- product-readiness gate を先頭で PASS させる
- trace bundle（audits/decisions/timeline）を artifact で回収

## 5. Evidence Package
- W4の証跡は以下に集約する:
  - `docs/CATCHUP_4W_EVIDENCE.md`
  - `docs/CATCHUP_GO_DECISION_PACKAGE.md`
  - `artifacts/stg-notification-e2e/*.json`
  - `artifacts/stg-notification-e2e/*.md`

## 6. Go / No-Go Rule
- Go条件:
  - stg固定順E2E `pass=6 fail=0 skip=0`
  - `product-readiness` が `status=GO`
  - route_error count が全シナリオで 0
  - required audit actions 欠落が 0
- No-Go条件:
  - 上記のいずれか未達
  - UI辞書契約/ナビ契約のテスト失敗
