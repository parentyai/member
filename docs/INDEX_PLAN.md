# INDEX_PLAN

- 目的: missing-index fallback の発生箇所を固定し、index作成順を明示する。
- 入力: `docs/REPO_AUDIT_INPUTS/load_risk.json` (fallback_points=0)
- 判定: `src/repos/firestore/indexFallbackPolicy.js` により stg/prod は fail-safe。

| file | lines | mode | notes |
| --- | --- | --- | --- |

## CI Gate
- 新規 fallback 発生箇所を追加した場合は fail。
- index未定義クエリの追加時は本ドキュメント追記を必須化。
