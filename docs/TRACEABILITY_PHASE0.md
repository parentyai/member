# Traceability Matrix Phase0

Linked Task: P0-004, P0-122

## High-Level Map (SSOT 0-7)

| SSOT Section | Planned Implementation Files | Planned Tests | Playbook Reference | Status |
| --- | --- | --- | --- | --- |
| 0. 用語 | docs/SSOT_PHASE0.md, src/domain/constants.js | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_BUILD.md | 実装済 (docs/stub) |
| 1. 目的・成功定義 | docs/ACCEPTANCE_PHASE0.md | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_E2E.md | 実装済 (docs) |
| 2. 体験設計（UX） | apps/mini/, apps/admin/, src/domain/validators.js | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| 3. 通知コピー | scripts/seed_phase0.js, docs/SSOT_PHASE0.md | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_BUILD.md | 実装済 (seed stub) |
| 4. 管理画面 操作フロー | apps/admin/, docs/PLAYBOOK_PHASE0_E2E.md | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| 5. 補足（運用原則） | docs/RUNBOOK_PHASE0.md, docs/PLAYBOOK_PHASE0_INCIDENT.md | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_INCIDENT.md | 実装済 (docs) |
| 6. 実装仕様パッケージ | See SSOT 6.6-6.11 details below | tests/phase0/smoke.test.js | docs/PLAYBOOK_PHASE0_BUILD.md | 未実装 |
| 7. 実装ガバナンス | TODO_PHASE0.md, docs/GUARDRAILS_PHASE0.md, docs/ARCHITECTURE_PHASE0.md | tests/phase0/README.md | docs/PLAYBOOK_PHASE0_DEBUG.md | 実装済 (docs) |

---

## SSOT 6.6: データモデル（Firestore）

| Entity (SSOT) | Planned Implementation (file::function) | Planned Tests (file::test) | Playbook | Status |
| --- | --- | --- | --- | --- |
| users/{lineUserId} | src/repos/firestore/usersRepo.js::createUser/getUser/updateUser/setMemberNumber/setMemberCardAsset; src/usecases/users/ensureUser.js::ensureUserFromWebhook | tests/phase0/webhook.test.js::"webhook: valid signature creates user" | docs/PLAYBOOK_PHASE0_DEBUG.md | 一部実装済 (repo + webhook) |
| notifications/{notificationId} | src/repos/firestore/notificationsRepo.js::createNotification/getNotification/listNotifications/updateNotificationStatus | tests/phase0/notifications.test.js::"create notification" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (repo) |
| notification_deliveries/{deliveryId} | src/repos/firestore/deliveriesRepo.js::createDelivery/markRead/markClick | tests/phase0/notifications.test.js::"delivery created on send" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (repo) |
| link_registry/{linkId} | src/repos/firestore/linkRegistryRepo.js::createLink/updateLink/listLinks/setHealth; src/usecases/linkRegistry/*.js | tests/phase0/linkRegistry.test.js::"linkRegistryRepo: setHealth stores WARN state" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (repo + handler) |
| audit_logs/{logId} | src/repos/firestore/auditLogsRepo.js::appendAuditLog; src/usecases/audit/appendAuditLog.js::appendAuditLog | tests/phase0/audit.test.js::"auditLogsRepo: append writes createdAt" | docs/PLAYBOOK_PHASE0_INCIDENT.md | 一部実装済 (repo + handler) |
| system_flags/phase0 | src/repos/firestore/systemFlagsRepo.js::getKillSwitch/setKillSwitch; src/usecases/killSwitch/setKillSwitch.js::setKillSwitch/getKillSwitch | tests/phase0/killSwitch.test.js::"killSwitch: default false, set true" | docs/PLAYBOOK_PHASE0_DEBUG.md | 一部実装済 (repo + handler) |

## SSOT 6.7: API設計

| API (SSOT) | Planned Implementation (file::function) | Planned Tests (file::test) | Playbook | Status |
| --- | --- | --- | --- | --- |
| POST /webhook/line | src/routes/webhookLine.js::handleLineWebhook; src/usecases/users/ensureUser.js::ensureUserFromWebhook | tests/phase0/webhook.test.js::"webhook: valid signature creates user" | docs/PLAYBOOK_PHASE0_BUILD.md | 一部実装済 (handler) |
| POST /admin/notifications | src/routes/admin/notifications.js::handleCreate; src/usecases/notifications/createNotification.js::createNotification; src/domain/validators.js::validateSingleCta/validateLinkRequired/validateWarnLinkBlock | tests/phase0/notifications.test.js::"createNotification: stores draft notification" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler + usecase) |
| POST /admin/notifications/:id/test-send | src/routes/admin/notifications.js::handleTestSend; src/usecases/notifications/testSendNotification.js::testSendNotification | tests/phase0/testSendNotification.test.js::"testSendNotification: creates delivery after push" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler) |
| POST /admin/notifications/:id/send | src/routes/admin/notifications.js::handleSend; src/usecases/notifications/sendNotification.js::sendNotification | tests/phase0/notifications.test.js::"sendNotification: creates deliveries for matching users" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler + usecase) |
| GET /admin/notifications | src/routes/admin/notifications.js::handleList; src/usecases/notifications/listNotifications.js::listNotifications | tests/phase0/notifications.test.js::"listNotifications: filters by scenarioKey" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler + usecase) |
| POST /admin/kill-switch | src/routes/admin/killSwitch.js::handleSetKillSwitch; src/usecases/killSwitch/setKillSwitch.js::setKillSwitch | tests/phase0/killSwitch.test.js::"killSwitch: default false, set true" | docs/PLAYBOOK_PHASE0_DEBUG.md | 一部実装済 (handler) |
| CRUD /admin/link-registry | src/routes/admin/linkRegistry.js::handleCreate/handleList/handleUpdate/handleDelete/handleHealth; src/usecases/linkRegistry/createLink.js::createLink; src/usecases/linkRegistry/listLinks.js::listLinks; src/usecases/linkRegistry/updateLink.js::updateLink; src/usecases/linkRegistry/deleteLink.js::deleteLink; src/usecases/linkRegistry/checkLinkHealth.js::checkLinkHealth | tests/phase0/linkRegistry.test.js::"linkRegistryRepo: setHealth stores WARN state" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler) |
| POST /track/click | src/routes/trackClick.js::handleTrackClick; src/usecases/track/recordClickAndRedirect.js::recordClickAndRedirect | tests/phase0/click.test.js::"recordClickAndRedirect: marks click and returns url" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler + usecase) |

## SSOT 6.8: 画面仕様（ミニアプリ / 管理画面）

| Screen (SSOT) | Planned UI File::Component | Planned API Calls | Planned Tests (file::test) | Playbook | Status |
| --- | --- | --- | --- | --- | --- |
| Mini App /inbox | apps/mini/inbox.html | src/usecases/mini/getInbox.js::getInbox | tests/phase0/miniapp.test.js::"getInbox: returns deliveries with notification data" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (static UI + usecase) |
| Mini App /checklist | apps/mini/checklist.html | src/usecases/mini/getChecklist.js::getChecklist | tests/phase0/miniapp.test.js::"getChecklist: returns items for scenario/step" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (static UI + usecase) |
| Mini App /member | apps/mini/src/pages/Member.js::MemberPage | src/usecases/mini/updateMember.js::updateMember | tests/phase0/miniapp.test.js::"member number update" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /dashboard | apps/admin/src/pages/Dashboard.js::DashboardPage | src/usecases/notifications/listNotifications.js::listNotifications | tests/phase0/adminUi.test.js::"dashboard renders" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /notifications/new | apps/admin/src/pages/notifications/New.js::NotificationNewPage | src/usecases/notifications/createNotification.js::createNotification | tests/phase0/adminUi.test.js::"create notification" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /notifications | apps/admin/src/pages/notifications/Index.js::NotificationListPage | src/usecases/notifications/listNotifications.js::listNotifications | tests/phase0/adminUi.test.js::"list notifications" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /links | apps/admin/src/pages/links/Index.js::LinkRegistryPage | src/usecases/linkRegistry/listLinks.js::listLinks | tests/phase0/adminUi.test.js::"link registry" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /audit | apps/admin/src/pages/audit/Index.js::AuditLogPage | src/usecases/audit/listAuditLogs.js::listAuditLogs | tests/phase0/adminUi.test.js::"audit log" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| Admin /settings | apps/admin/src/pages/settings/Index.js::SettingsPage | src/usecases/killSwitch/setKillSwitch.js::setKillSwitch | tests/phase0/adminUi.test.js::"kill switch toggle" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |

## SSOT 6.3.4: 初回メッセージ（登録直後1回）

| Requirement (SSOT) | Planned Implementation (file::function) | Planned Tests (file::test) | Playbook | Status |
| --- | --- | --- | --- | --- |
| 初回メッセージを1回だけ送信 | src/routes/webhookLine.js::handleLineWebhook; src/usecases/notifications/sendWelcomeMessage.js::sendWelcomeMessage | tests/phase0/welcome.test.js::"sendWelcomeMessage: sends once and records delivery" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (usecase + webhook) |

## SSOT 6.9: 実装順序（厳守）

| Step | SSOT Order | Task ID | Planned Files / Functions | Planned Tests | Playbook | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | DBスキーマCRUD | P0-101 | src/repos/firestore/usersRepo.js::createUser/getUser/updateUser; src/repos/firestore/notificationsRepo.js::createNotification/listNotifications; src/repos/firestore/deliveriesRepo.js::createDelivery/markRead/markClick; src/repos/firestore/linkRegistryRepo.js::createLink/listLinks/setHealth; src/repos/firestore/auditLogsRepo.js::appendAuditLog; src/repos/firestore/systemFlagsRepo.js::getKillSwitch/setKillSwitch | tests/phase0/usersRepo.test.js::"create user"; tests/phase0/notificationsRepo.test.js::"create notification" | docs/PLAYBOOK_PHASE0_BUILD.md | 未実装 |
| 2 | LINE webhookでuserId取得→users作成 | P0-102 | src/routes/webhookLine.js::handleLineWebhook; src/usecases/users/ensureUser.js::ensureUserFromWebhook | tests/phase0/webhook.test.js::"creates user" | docs/PLAYBOOK_PHASE0_BUILD.md | 未実装 |
| 3 | push送信（テスト送信） | P0-103 | src/infra/lineClient.js::pushMessage; src/usecases/notifications/testSendNotification.js::testSendNotification | tests/phase0/notifications.test.js::"test send creates delivery" | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |
| 4 | 管理画面: 通知作成→テスト送信→配信 | P0-104 | src/routes/admin/notifications.js::handleCreate/handleTestSend/handleSend | tests/phase0/notifications.test.js::"sendNotification: creates deliveries for matching users" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (create/send handlers) |
| 5 | ミニアプリ: inbox/checklist表示 | P0-107 | apps/mini/inbox.html; apps/mini/checklist.html; src/usecases/mini/getInbox.js::getInbox; src/usecases/mini/getChecklist.js::getChecklist | tests/phase0/miniapp.test.js::"getInbox/getChecklist" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (static UI + usecase) |
| 6 | クリック計測→リダイレクト | P0-108 | src/routes/trackClick.js::handleTrackClick; src/usecases/track/recordClickAndRedirect.js::recordClickAndRedirect | tests/phase0/click.test.js::"recordClickAndRedirect: marks click and returns url" | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler + usecase) |
| 7 | Kill Switch / 監査ログ / Link Registryヘルス | P0-106/P0-109/P0-105 | src/usecases/killSwitch/setKillSwitch.js::setKillSwitch; src/repos/firestore/auditLogsRepo.js::appendAuditLog; src/usecases/linkRegistry/checkLinkHealth.js::checkLinkHealth | tests/phase0/killSwitch.test.js::"blocks send"; tests/phase0/audit.test.js::"auditLogsRepo: append writes createdAt"; tests/phase0/linkRegistry.test.js::"health check" | docs/PLAYBOOK_PHASE0_DEBUG.md | 一部実装済 (kill switch + link registry + audit logging) |

## SSOT 6.10: 最低限テスト（Phase0合格ライン）

| Requirement (SSOT) | Planned Test (file::test) | Related Implementation | Playbook | Status |
| --- | --- | --- | --- | --- |
| webhook受信でusersが作られる | tests/phase0/webhook.test.js::"creates user on webhook" | src/routes/webhookLine.js::handleLineWebhook | docs/PLAYBOOK_PHASE0_BUILD.md | 未実装 |
| 通知作成→テスト送信が成功 | tests/phase0/testSendNotification.test.js::"testSendNotification: creates delivery after push" | src/routes/admin/notifications.js::handleTestSend | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (handler) |
| 配信で対象ユーザーにdeliveryが作られる | tests/phase0/notifications.test.js::"sendNotification: creates deliveries for matching users" | src/usecases/notifications/sendNotification.js::sendNotification | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (usecase) |
| クリックでclickAtが記録 | tests/phase0/click.test.js::"recordClickAndRedirect: marks click and returns url" | src/usecases/track/recordClickAndRedirect.js::recordClickAndRedirect | docs/PLAYBOOK_PHASE0_E2E.md | 一部実装済 (usecase) |
| Kill Switch ONで配信が拒否 | tests/phase0/testSendNotification.test.js::"testSendNotification: blocked when kill switch ON" | src/usecases/notifications/testSendNotification.js::testSendNotification | docs/PLAYBOOK_PHASE0_DEBUG.md | 一部実装済 (usecase) |
| WARNリンクが通知に紐付けできない | tests/phase0/linkRegistry.test.js::"WARN link cannot be used" | src/domain/validators.js::validateNotificationPayload | docs/PLAYBOOK_PHASE0_E2E.md | 未実装 |

## SSOT 6.11: 出力物（実装完了時に必須）

| Deliverable (SSOT) | File Path | Evidence | Playbook | Status |
| --- | --- | --- | --- | --- |
| 実装したファイル一覧 | docs/IMPLEMENTED_FILES_PHASE0.md | 未作成 | N/A | 未実装 |
| 起動手順（ENV含む） | docs/PLAYBOOK_PHASE0_BUILD.md | ファイル存在 | docs/PLAYBOOK_PHASE0_BUILD.md | 実装済 |
| 1回のE2E手順 | docs/PLAYBOOK_PHASE0_E2E.md | ファイル存在 | docs/PLAYBOOK_PHASE0_E2E.md | 実装済 |
| ロールバック手順 | docs/RUNBOOK_PHASE0.md | ファイル存在 | docs/RUNBOOK_PHASE0.md | 実装済 |
| 既知の制限（Phase0範囲） | docs/LIMITATIONS_PHASE0.md | 未作成 | N/A | 未実装 |
