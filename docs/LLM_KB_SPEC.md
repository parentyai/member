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
- `status` (`active` | `draft` | `archived`)
- `version` (integer)
- `riskLevel` (`low` | `medium` | `high`)
- `allowedIntents` (string[])
- `linkRegistryIds` (string[])
- `locale` (string, default `ja`)
- `updatedAt` (timestamp)

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
- 対象: `status=active` かつ `locale` 一致
- スコア: `keywords/synonyms/tags` 一致数ベース
- 上位 `limit` 件を候補にする

## Block 条件
- active 候補 0 件: `kb_no_match`
- citation 0 件: `citations_required`
- linkRegistryId が存在しない: `missing_link_registry`
- link health WARN: `warn_link_blocked`
- direct URL: `direct_url_forbidden`

## 注入耐性
- KB 本文は命令ではなくデータとして扱う。
- 回答生成時は schema 固定（FAQAnswer.v1）。
- 根拠に存在しない断定は禁止。
