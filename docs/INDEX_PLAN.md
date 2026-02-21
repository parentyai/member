# INDEX_PLAN

- 目的: missing-index fallback の発生箇所を固定し、index作成順を明示する。
- 入力: `docs/REPO_AUDIT_INPUTS/load_risk.json` (fallback_points=40)
- 判定: `src/repos/firestore/indexFallbackPolicy.js` により stg/prod は fail-safe。

| file | lines | mode | notes |
| --- | --- | --- | --- |
| `src/repos/firestore/cityPackBulletinsRepo.js` | 5, 90 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackFeedbackRepo.js` | 5, 107 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackMetricsDailyRepo.js` | 4, 112 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackRequestsRepo.js` | 5, 118 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackTemplateLibraryRepo.js` | 5, 92 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackUpdateProposalsRepo.js` | 5, 89 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPacksRepo.js` | 5, 294 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/decisionDriftsRepo.js` | 4, 33 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/decisionLogsRepo.js` | 4, 36, 58, 87 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/linkRegistryRepo.js` | 4, 49 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/notificationTemplatesRepo.js` | 5, 61 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/notificationsRepo.js` | 4, 43 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/queryFallback.js` | 47, 59 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/sendRetryQueueRepo.js` | 4, 54 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/sourceEvidenceRepo.js` | 5, 65, 82 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/sourceRefsRepo.js` | 5, 175 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/templatesVRepo.js` | 5, 53, 95 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/usersRepo.js` | 4, 98 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |

## CI Gate
- 新規 fallback 発生箇所を追加した場合は fail。
- index未定義クエリの追加時は本ドキュメント追記を必須化。
