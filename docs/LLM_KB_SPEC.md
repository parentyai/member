# LLM_KB_SPEC

## 目的
- FAQ 回答の根拠を Firestore KB に限定し、回答の追跡可能性を固定する。

## Collections

### `faq_articles/{id}`
必須フィールド:
- `title` (string)
- `body` (string)
- `tags` (string[])
- `keywords` (string[])
- `synonyms` (string[])
- `status` (`active` | `draft` | `disabled`)
- `versionSemver` (string, e.g. `1.2.0`)
- `riskLevel` (`low` | `medium` | `high`)
- `allowedIntents` (string[])
- `linkRegistryIds` (string[])
- `locale` (string, default `ja`)
- `validUntil` (timestamp)
- `disclaimerVersion` (string)
- `updatedAt` (timestamp)

互換維持:
- `version` (integer) は legacy reader 互換のため残置可。

### `faq_answer_logs/{id}`
監査補助ログ（append-only）:
- `traceId`
- `questionHash` (plaintext question は保存しない)
- `locale`
- `matchedArticleIds` (string[])
- `blockedReason` (nullable)
- `createdAt`

## 検索方式（初期）
- ルール検索のみ（embedding 未使用）
- 対象: `status=active` かつ `locale` 一致 かつ `validUntil > now`
- `allowedIntents` が設定されている場合は、指定 intent（未指定時 `FAQ`）を含む記事のみ対象
- スコア: BM25 風の重み付き一致（`keywords/synonyms/tags/title/body`）
- 信頼度判定:
  - `MIN_SCORE = 1.2`
  - `TOP1_TOP2_RATIO = 1.2`
  - `top1 < MIN_SCORE` または `top1/top2 < TOP1_TOP2_RATIO` は `low_confidence` として BLOCK
- 上位 `limit` 件を候補にする

## Block 条件
- active 候補 0 件: `kb_no_match`
- 候補信頼度不足: `low_confidence`
- citation 0 件: `citations_required`
- linkRegistryId が存在しない: `missing_link_registry`
- link health WARN: `warn_link_blocked`
- direct URL: `direct_url_forbidden`
- high risk 記事で問い合わせ導線 citation が不足: `contact_source_required`

## 注入耐性
- KB 本文は命令ではなくデータとして扱う。
- 回答生成時は schema 固定（FAQAnswer.v1）。
- 根拠に存在しない断定は禁止。

## Phase243-244 Add-only Contract
- `faq_articles` のバージョン互換:
  - `version` (semver string) を優先して使用する。
  - `versionSemver` は legacy 互換として読み取り継続する。
  - `version` / `versionSemver` が存在して形式不正（semver非準拠）の場合、該当記事は検索対象外（fail-closed）。
- スキーマ正規化:
  - `riskLevel` は `low|medium|high` のみ許可（不正値は検索対象外）。
  - `allowedIntents` は配列のみ許可（不正型は検索対象外）。
- FAQ 応答メタ:
  - `kbMeta.matchedCount/top1Score/top2Score/top1Top2Ratio` を success / blocked の両方で返却する。
