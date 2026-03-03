# SSOT_URL_RANKING_AND_ALLOWLIST_V1

## Purpose
根拠URLの品質を機械的に制御し、低品質/詐欺/SEO/注入経路を遮断する。

## URL Rank
- R0: 公式一次
  - `.gov` `.mil` `.edu`
  - 自治体公式、学校区公式、官公庁公式
- R1: 準公式
  - 大手病院、学会、非営利、国際機関
  - 公式準拠の一次参照
- R2: 参考
  - 大手報道、大手イベント、観光公式に準ずる情報
- R3: 禁止
  - 個人ブログ、まとめ、掲示板、SEOファーム
  - 短縮URL、危険/不明TLD、出自不明

## Topic x Rank Policy
- Mode A: URL提示なし
- Mode B: R0/R1 のみ
- Mode C: R0/R1/R2（有料フル、無料は保存済みURLのみかつ1件上限）
- R3は常時拒否

## Allowlist / Denylist 運用
- allowlist:
  - 運用で信頼済みドメインを優先採用するための補助リスト。
  - 追加は add-only。
- denylist:
  - 詐欺/なりすまし/既知不正ドメインを拒否する最優先リスト。
  - マッチ時は rank 判定に関係なく拒否。
- 変更は監査対象とし、理由を記録する。

## Mechanical Guards
- 短縮URL（例: `bit.ly`, `tinyurl.com`, `t.co`）を拒否。
- `http/https` 以外を拒否。
- 疑わしいTLD（例: `zip`, `click`, `xyz` など）を拒否。
- 重複URL（domain/path一致）は1件に集約。
- モード別上限を超えるURLは採用しない。

## Audit Keys
- `urls[].rank`
- `urls[].allowed`
- `urls[].reason`
- `guardDecisions[]`
- `blockedReasons[]`
