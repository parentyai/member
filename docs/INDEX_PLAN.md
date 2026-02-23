# INDEX_PLAN

- 目的: missing-index fallback の発生箇所を固定し、index作成順を明示する。
- 入力: `docs/REPO_AUDIT_INPUTS/load_risk.json` (fallback_points=16)
- 判定: `src/repos/firestore/indexFallbackPolicy.js` により stg/prod は fail-safe。

| file | lines | mode | notes |
| --- | --- | --- | --- |
| `src/repos/firestore/cityPackBulletinsRepo.js` | 91 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackFeedbackRepo.js` | 142 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackMetricsDailyRepo.js` | 113 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackRequestsRepo.js` | 153 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackTemplateLibraryRepo.js` | 93 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPackUpdateProposalsRepo.js` | 90 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/cityPacksRepo.js` | 339 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/decisionLogsRepo.js` | 37, 65, 100 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/sourceEvidenceRepo.js` | 66, 89 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/sourceRefsRepo.js` | 206 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/templatesVRepo.js` | 54, 102 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |
| `src/repos/firestore/usersRepo.js` | 104 | stg/prod=fail-safe, local=test=fail-open | index作成完了後にfallback経路を段階停止 |

## CI Gate
- 新規 fallback 発生箇所を追加した場合は fail。
- index未定義クエリの追加時は本ドキュメント追記を必須化。
