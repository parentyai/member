# SSOT_LINE_ONLY_DELTA

Append-only delta notes to operate this product as **LINE-only** (no mini-app / LIFF as the main channel).

## Purpose
- Fix the operational SSOT boundaries for LINE-only operation.
- Clarify which Cloud Run services are public/private and what each is allowed to do.
- Define the minimal event append policy for webhook inputs (auditable facts).

## Service Boundaries (MUST)

### `member` (private)
- Purpose: Admin/Ops UI + internal APIs + writes to Firestore SSOT.
- IAM: **private** (`--no-allow-unauthenticated`).
- Allowed endpoints: all existing admin/API endpoints (as implemented).

### `member-track` (public)
- Purpose: click tracking surface (redirect) + best-effort stats writes.
- IAM: **public** (`--allow-unauthenticated`).
- Allowed endpoints:
  - `POST /track/click` (existing)
  - (Phase126 will add an additional GET click surface; add-only)

### `member-webhook` (public)
- Purpose: LINE Messaging API webhook receiver.
- IAM: **public** (`--allow-unauthenticated`) because LINE cannot send auth headers.
- Env: `SERVICE_MODE=webhook`
- Allowed endpoints (webhook-only):
  - `GET /healthz` (and `/healthz/`)
  - `POST /webhook/line` (and `/webhook/line/`)
- Everything else MUST be `404 not found`.

## Webhook Input -> SSOT append (MUST, add-only)
- On every verified webhook request, append best-effort records to Firestore `events`.
- This does **not** change the meaning of existing `events` types; it only adds new types.

### Minimal schema (events)
- `lineUserId`: from `event.source.userId` (skip if missing)
- `type`: `line_webhook.<event.type>` (e.g. `line_webhook.follow`, `line_webhook.unfollow`, `line_webhook.message`)
- `ref`: best-effort metadata (small, no full message body)
  - `requestId`, `timestampMs`, `messageId`, `messageType`, `sourceType`, `groupId`, `roomId`, etc.
- `createdAt`: server timestamp (authoritative)

## Side effects on webhook edge (MUST)
- The webhook edge MUST avoid unnecessary side effects that require broader secrets.
  - Example: welcome push is suppressed by default when `SERVICE_MODE=webhook`.
- The private `member` service may keep user onboarding side effects (welcome push), guarded by its own environment/secrets.

## Reaction Definitions (LINE-only)
Ops が「この反応は信用してよいか？」で迷わないための運用定義。

### click
- 唯一「ユーザーの明示的行動」として信用する
- SSOT: `notification_deliveries.clickAt`

### read
- LINE-only では補助的シグナル
- あっても判断の主軸にしない
- SSOT: `notification_deliveries.readAt`（存在する場合のみ）

### open
- 内部イベント（`events`）としてのみ扱う
- Ops判断の直接材料には使わない（LINE-only での信頼度が低い）

## Ops Display Rule (LINE-only)
- 「最終反応（LINE定義）」は click を優先する
  - `lastReactionAt = clickAt ?? readAt ?? null`
