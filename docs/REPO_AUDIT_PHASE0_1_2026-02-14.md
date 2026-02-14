# REPO_AUDIT_PHASE0_1_2026-02-14

この文書は「フェーズ0: 監査計画」「フェーズ1: 現状監査（証拠付き）」をまとめたもの。
憶測は記載しない。根拠がない項目は「未確認」として明示する。

## フェーズ0：監査計画

### 監査観点チェックリスト（最低）
- アーキテクチャ（起動点/モード切替/エントリ）
- 通知（テンプレ/承認/送信/停止/頻度制御/重複防止）
- 管理UI（画面/権限/危険操作ガード）
- API（管理APIの保護/入力/エラー）
- データ（主要コレクション/保持/匿名化）
- セキュリティ（PII非保持境界/権限/監査ログ）
- 監査ログ（traceId/decision_logs/timeline）
- 運用（Runbook/復旧/ロールバック）

### 重要ファイル地図（SSOT/Runbook/導線）
| 種別 | 説明 | 根拠 |
|---|---|---|
| SSOT入口 | 監査・運用・SSOTの入口 | `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md:1-20` |
| 管理UI SSOT | 運用OSの原則/安全ルール/IA | `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:1-77` |
| UI表示SSOT | 画面名/見出し/状態のSSOT | `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md:1-176` |
| UIデータモデル SSOT | 編集対象/2段階操作 | `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_DATA_MODEL.md:1-40` |
| 通知プリセット SSOT | A/B/C定義 | `/Users/parentyai.com/Projects/Member/docs/SSOT_NOTIFICATION_PRESETS.md:1-55` |
| Phase×Preset SSOT | 許可範囲マトリクス | `/Users/parentyai.com/Projects/Member/docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md:1-31` |
| 監査Runbook | traceIdの再現手順 | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_TRACE_AUDIT.md:1-44` |
| 運用Runbook | 日次/事故対応 | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:1-145` |
| Ops判断Runbook | 判断/停止/復旧 | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_OPS.md:1-87` |
| データマップ | 保存/保持/責任分界 | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:1-132` |
| デプロイRunbook | stg/prod分離 | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md:1-139` |

### マニュアル化できる範囲 / 書けない範囲
| 範囲 | 状態 | 理由 | 根拠 |
|---|---|---|---|
| 管理UIの画面/操作 | 記載可能 | UIラベル/SSOT/Runbookで確認できる | `/Users/parentyai.com/Projects/Member/apps/admin/*.html`、`/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:48-77`、`/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md:9-154`、`/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:10-145` |
| 通知の作成→承認→送信 | 記載可能 | UI/ルート/Runbookが一致 | `/Users/parentyai.com/Projects/Member/apps/admin/composer.html:30-114`、`/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:33-159` |
| 送信停止（Kill Switch） | 記載可能 | UI/SSOT/Runbookに明記 | `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-66`、`/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:85-97` |
| LLM運用 | 記載可能（制限付き） | 提案のみ/disabled by default | `/Users/parentyai.com/Projects/Member/src/usecases/phase40/getOpsAssistSuggestion.js:124-213`、`/Users/parentyai.com/Projects/Member/docs/RUNBOOK_OPS_ASSIST.md:1-15` |
| 法令適合の最終判断 | 未確認 | 法務判断は別証跡が必要 | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:113-131` |

## フェーズ1：現状監査（証拠付き）

### 1) 管理UI（画面/ルート/主要コンポーネント/権限/危険操作ガード）
| 項目 | 現状 | 根拠 |
|---|---|---|
| 画面（IA: ops/composer/monitor/errors/master/read-model/review/login） | SSOTに8画面が定義 | `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:48-58` |
| 画面（実装: ops/composer/monitor/errors/master/read-model/review/login） | `/admin/*` で提供 | `/Users/parentyai.com/Projects/Member/src/index.js:364-502`、`/Users/parentyai.com/Projects/Member/src/index.js:1675-1684` |
| Ops Console | READ ONLY + 判断補助 | `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:22-127` |
| Composer | draft→approve→plan→execute | `/Users/parentyai.com/Projects/Member/apps/admin/composer.html:30-114` |
| Monitor | 配信結果の閲覧 | `/Users/parentyai.com/Projects/Member/apps/admin/monitor.html:28-66` |
| Errors | WARN/Retryの参照 | `/Users/parentyai.com/Projects/Member/apps/admin/errors.html:25-58` |
| Master | System Config / Automation / Recovery / Redac解除 | `/Users/parentyai.com/Projects/Member/apps/admin/master.html:111-241` |
| Read Model | 通知集計の閲覧 | `/Users/parentyai.com/Projects/Member/apps/admin/read_model.html:6-16` |
| Review | 手動レビュー記録 | `/Users/parentyai.com/Projects/Member/apps/admin/review.html:6-17` |
| 危険操作ガード | confirm token必須 | `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:12-17`、`/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-55` |
| 管理API保護 | ADMIN_OS_TOKEN による app-layer guard | `/Users/parentyai.com/Projects/Member/src/index.js:314-332` |

### 2) 通知（テンプレ/ステップ/お知らせ/配信実行/停止/頻度制御/重複防止）
| 項目 | 現状 | 根拠 |
|---|---|---|
| テンプレ status | draft/active/inactive | `/Users/parentyai.com/Projects/Member/src/repos/firestore/notificationTemplatesRepo.js:9-123` |
| バージョンテンプレ status | draft/active/archived | `/Users/parentyai.com/Projects/Member/src/repos/firestore/templatesVRepo.js:9-79` |
| 通知カテゴリ | 5種（SSOT + code） | `/Users/parentyai.com/Projects/Member/docs/SSOT_NOTIFICATION_PRESETS.md:28-35`、`/Users/parentyai.com/Projects/Member/src/domain/notificationCategory.js:3-21` |
| 通知作成→承認 | draft/active 操作 | `/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:33-106` |
| 送信 execute | planHash + confirmToken 必須 | `/Users/parentyai.com/Projects/Member/src/usecases/phase68/executeSegmentSend.js:198-239`、`/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:109-151` |
| Kill Switch | 送信停止の最終ガード | `/Users/parentyai.com/Projects/Member/src/usecases/phase68/executeSegmentSend.js:170-174`、`/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-55` |
| 二重送信防止 | deliveryId固定/予約→skip | `/Users/parentyai.com/Projects/Member/src/domain/deliveryId.js:19-31`、`/Users/parentyai.com/Projects/Member/src/usecases/notifications/sendNotification.js:99-121` |
| 送信上限制御（caps） | perUser/perCategory/quietHours | `/Users/parentyai.com/Projects/Member/src/domain/notificationCaps.js:45-223`、`/Users/parentyai.com/Projects/Member/docs/SSOT_NOTIFICATION_PRESETS.md:11-18` |

### 3) ログ（notification_deliveries / audit_logs / policyDecision / reasonCode / 追跡ID）
| 項目 | 現状 | 根拠 |
|---|---|---|
| audit_logs | append-only + traceId | `/Users/parentyai.com/Projects/Member/src/repos/firestore/auditLogsRepo.js:3-53`、`/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:40-48` |
| decision_logs | 決定ログ | `/Users/parentyai.com/Projects/Member/src/repos/firestore/decisionLogsRepo.js:6-121` |
| decision_timeline | 時系列ログ | `/Users/parentyai.com/Projects/Member/src/repos/firestore/decisionTimelineRepo.js:5-71` |
| notification_deliveries | delivery状態/反応/封印 | `/Users/parentyai.com/Projects/Member/src/repos/firestore/deliveriesRepo.js:183-231`、`/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:55-67` |
| policyDecision / reasonCode | policy/cap の理由が audit に記録 | `/Users/parentyai.com/Projects/Member/src/usecases/phase68/executeSegmentSend.js:284-304`、`/Users/parentyai.com/Projects/Member/src/domain/notificationCaps.js:125-208` |
| traceId 検索 | APIでbundle取得 | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_TRACE_AUDIT.md:29-33` |

### 4) データ（主要コレクション/スキーマ/インデックス/保持/匿名化）
| 項目 | 現状 | 根拠 |
|---|---|---|
| 主要コレクション | users/audit_logs/notification_deliveries 等 | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:15-67` |
| 会員IDの匿名化 | Redac IDはHMAC + last4 | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:12-39` |
| Retention | 自動TTLなし（別途GCP） | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:90-113` |
| retry queue | send_retry_queue PENDING/DONE/GAVE_UP | `/Users/parentyai.com/Projects/Member/src/repos/firestore/sendRetryQueueRepo.js:6-89` |

### 5) LLM（提案のみか実行か / ログ / ガード）
| 項目 | 現状 | 根拠 |
|---|---|---|
| LLMは提案のみ | disabled by default / advisory | `/Users/parentyai.com/Projects/Member/src/usecases/phase40/getOpsAssistSuggestion.js:124-213`、`/Users/parentyai.com/Projects/Member/docs/RUNBOOK_OPS_ASSIST.md:13-15` |
| 採用監査 | LLM_SUGGESTION / ADOPTED | `/Users/parentyai.com/Projects/Member/src/usecases/phase104/appendLlmSuggestionAudit.js:12-28`、`/Users/parentyai.com/Projects/Member/src/usecases/phase105/appendLlmAdoptAudit.js:12-28` |
| 実行主体 | 人間Opsが実行 | `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:6-15` |

### 6) 環境（stg/prod切替/secret/variable/デプロイ/ロールバック）
| 項目 | 現状 | 根拠 |
|---|---|---|
| stg/prod分離 | push(main)=stg, dispatch=prod | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md:11-139` |
| workflow環境変数 | vars から解決 | `/Users/parentyai.com/Projects/Member/.github/workflows/deploy.yml:30-96` |
| Secret preflight | 必須secret存在チェック | `/Users/parentyai.com/Projects/Member/.github/workflows/deploy.yml:146-188` |
| ロールバック | revert + env戻し | `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md:139-140` |

### 7) セキュリティ（PII非保持境界/アクセス制御/管理者操作の監査）
| 項目 | 現状 | 根拠 |
|---|---|---|
| PII非保持境界 | Redac IDは平文保存しない | `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:28-39` |
| 管理者操作の保護 | ADMIN_OS_TOKEN 必須 | `/Users/parentyai.com/Projects/Member/src/index.js:24-165` |
| 監査ログ | traceId/requestId 付き | `/Users/parentyai.com/Projects/Member/src/repos/firestore/auditLogsRepo.js:11-31` |

## 矛盾一覧（SSOTと実装のズレ）
| 内容 | 根拠 | 解消案 |
|---|---|---|
| 該当なし | UI表示SSOTが辞書に一本化され、IA/表示の矛盾は未検出 | `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md:6-154`、`/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:48-58` |

## 未確認事項（確認手順付き）
| 項目 | 状態 | 確認手順 |
|---|---|---|
| 法令最終判定 | 未確認 | `docs/DATA_MAP.md` を基に法務レビュー記録を確認 |
