# SSOT_NOTIFICATION_SEED_DUMMY_V1

Notification Composer の検証用ダミー投入を再現可能にする add-only 仕様。

## 1. Scope

- 対象UI: `/admin/app?pane=composer`
- 対象type: `GENERAL`, `ANNOUNCEMENT`, `VENDOR`, `AB`, `STEP`
- 目的: `draft -> approve -> plan -> execute` の管理導線を type 横断で確認する。

## 2. CLI Contract

- command: `npm run admin:seed-notifications`
- 実体: `node tools/admin_seed_notifications.js`

### options

- `--count-per-type <n>`: typeごとの作成件数（既定3）
- `--dry-run`: 実作成せず計画のみ出力
- `--apply`: typeごと1件を `approve -> plan -> execute` まで進める
- `--archive`: `seedTag/seedRunId` 一致通知を archive（非表示化）する
- `--seed-tag <tag>`: 既定 `dummy`
- `--seed-run-id <id>`: 実行識別子
- `--target-region <region>`: 配信対象region（既定 `nyc`）
- `--scenario-period-count <n>`: `A/B/C/D × (3mo/2mo/1mo/week/after1w/after1mo)` の各セルに `n` 件投入（typeを順番ローテーション）
- `--types <list>`: 対象通知type（`,`区切り）。既定は `GENERAL,ANNOUNCEMENT,VENDOR,AB,STEP`
- `--base-url <url>`: 既定 `http://127.0.0.1:8080`
- `--admin-token` / `--admin-token-file`
- `--actor`

## 3. Data Contract（add-only fields）

ダミー通知は既存契約を変更せず、次の識別フィールドを add-only で保存する。

- `seedTag`
- `seedRunId`
- `seededAt`
- `seedArchivedAt`
- `seedArchivedBy`
- `seedArchiveReason`
- `notificationMeta.dummyDependencyLabel`
- `notificationMeta.dummyDependsOnStep`
- `notificationMeta.dummyDependsOnOrder`
- `notificationMeta.dummySequenceOrder`

既存通知（非seed）は上記フィールドを必須にしない。

## 4. Archive Contract

- archive は削除を行わない（非破壊）。
- archive API: `POST /api/admin/os/notifications/seed/archive`
  - input: `seedTag`（default `dummy`）, `seedRunId`（optional）, `reason`（optional）
- list API: `GET /api/admin/os/notifications/list`
  - 既定は archive 済み seed を除外
  - `includeArchivedSeed=1` のときのみ表示可能

## 5. Composer UI Contract（developer toggle）

- Composer Matrix に `seed archive を表示（developer）` トグルを設置する。
- role が `developer` のときのみ表示・有効化する。
- role が `admin/operator` のときは強制OFFに戻す。

## 6. Safety Rules

- PIIを含むダミー文面は禁止。
- `VENDOR` は `notificationMeta.vendorId` を必須で満たす。
- `AB` は `ctaText2` の保存契約を変更しない（プレビュー専用のまま）。
- region 指定を省略した場合は `nyc` を使用する。
- titleは「内容を先頭・`[DUMMY][seedTag][seedRunId]` を末尾」に固定する。
- seed通知の `sourceRefs` は既定で付与しない（実行時の source validation ブロックを回避）。
- `--scenario-period-count` 使用時は `3mo/2mo/1mo/week/after1w/after1mo` の6期間を対象に、各シナリオへ均等投入する。
- `--scenario-period-count` 使用時は `dummyDependency*` を自動付与し、セル内の順序依存（#1→#2→...）と期間依存（`2mo -> 3mo`, `1mo -> 2mo`, `week -> 1mo`, `after1w -> week`, `after1mo -> after1w`）を表現する。
- `--types STEP --scenario-period-count 5` を使うと、STEP通知だけを各シナリオ/各期間に5件ずつ投入できる。
- 実行結果は `artifacts/admin-seed-notifications/<seedRunId>.json` に保存する。
