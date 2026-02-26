# SSOT_EMERGENCY_LAYER

Emergency Layer（City Packとは別レイヤ）の add-only 契約。

## 1. Purpose
- 全米公開APIを provider 単位で1回取得し、region差分だけを通知候補化する。
- 送信は人手承認後のみ実行する。
- 既存通知ガード（CTA=1 / link_registry必須 / WARN遮断 / 直URL禁止）を維持する。

## 2. Provider Contract
- `nws_alerts`
- `usgs_earthquakes`
- `fema_ipaws`
- `openfema_declarations`
- `openfda_recalls`
- `airnow_aqi`（optional, default disabled）

Default schedule:
- high: 10-15min (`nws_alerts`, `usgs_earthquakes`, `fema_ipaws`)
- medium: 60min (`openfema_declarations`, `airnow_aqi`)
- low: 360min (`openfda_recalls`)

## 3. Data Contract (Firestore, add-only)
- `emergency_providers`
- `emergency_snapshots`
- `emergency_events_normalized`
- `emergency_diffs`
- `emergency_bulletins`
- `emergency_unmapped_events`

## 4. Region Resolution Contract
- LLM禁止（再現性監査のため）。
- resolver実装: `src/usecases/emergency/regionResolvers/*`
- `state + city -> buildRegionKey(state, city)`
- `state only -> {STATE}::statewide`
- FIPSは州コードへ決定論マップ。
- 解決不可は `emergency_unmapped_events` へ隔離し、通知候補化しない。

## 5. Job Contract
- Job A: `fetchProviderSnapshot`
- Job B: `normalizeAndDiffProvider`
- Job C: `summarizeDraftWithLLM`（optional, 要約のみ）
- Central: `runEmergencySync`

Internal routes:
- `POST /internal/jobs/emergency-sync`
- `POST /internal/jobs/emergency-provider-fetch`
- `POST /internal/jobs/emergency-provider-normalize`
- `POST /internal/jobs/emergency-provider-summarize`

## 6. Admin Contract
Routes:
- `GET /api/admin/emergency/providers`
- `POST /api/admin/emergency/providers/{providerKey}`
- `POST /api/admin/emergency/providers/{providerKey}/force-refresh`
- `GET /api/admin/emergency/bulletins`
- `GET /api/admin/emergency/bulletins/{bulletinId}`
- `GET /api/admin/emergency/evidence/{bulletinId}`
- `POST /api/admin/emergency/bulletins/{bulletinId}/approve`
- `POST /api/admin/emergency/bulletins/{bulletinId}/reject`

UI pane:
- `/admin/app?pane=emergency-layer`

## 7. Guardrails
- kill switch優先: `systemFlagsRepo.getKillSwitch()` が true のとき fail-closed。
- provider disabled 時は fetch/normalize対象外。
- approve送信は既存 `createNotification -> sendNotification` 経路を使用。
- fan-out は `scenario(A-D) x step(3mo/1mo/week/after1w) = 16` 固定。
- `officialLinkRegistryId` 未設定時は draft作成のみ（send不可）。

## 8. Audit/Trace
- すべての job/admin action に `traceId` を付与。
- `audit_logs` に `emergency.*` action を append-only 記録。

