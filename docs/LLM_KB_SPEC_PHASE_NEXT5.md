# LLM + KB 統合仕様 — Phase Next-5

## 概要

Phase Next-5 では「per-user 同意チェック付き LINE FAQ ルーティング」を実施した。
Phase Next-4 で収集した `user_consents` データを活用し、同意済みユーザーのメッセージを
LINE Webhook 経由で FAQ LLM 回答システムに接続した。
advisory-only / disabled by default / killSwitch 分離 は変更しない。

---

## 1. 追加コンポーネント

### 1-A. `src/usecases/faq/answerFaqForLine.js` — 新規作成

LINE ユーザー向け FAQ 回答ラッパー。per-user consent チェック → `answerFaqFromKb` 委譲 → LINE 用フォーマット。

```
answerFaqForLine(params, deps) → { ok, blocked, blockedReason, lineMessage, [faqAnswer, traceId] }

params:
  lineUserId: string (必須)
  question:   string (必須)
  locale:     string (省略時: 'ja')
  traceId:    string|null
  requestId:  string|null

deps (DI):
  getUserLlmConsent:  (lineUserId) → ConsentRecord|null
  answerFaqFromKb:    (params, deps) → FaqResult
  (answerFaqFromKb の deps もすべて pass-through)
```

**処理フロー:**

```
1. getUserLlmConsent(lineUserId)
2. consent.llmConsentStatus !== 'accepted' → blocked: user_consent_not_accepted
3. answerFaqFromKb({ question, locale, traceId, requestId, actor: lineUserId }, deps)
4. faqResult.blocked → map blockedReason → lineMessage
5. faqResult.blocked=false → formatFaqAnswerForLine(result) (max 1900 chars + disclaimer)
```

**blockedReason → LINE メッセージ マッピング:**

| blockedReason | LINE メッセージ |
|---|---|
| `user_consent_not_accepted` | AI機能の利用に同意していません。\n「AI同意」とメッセージを送ると同意できます。|
| `llm_disabled` | AI機能は現在無効です。|
| `consent_missing` | AI機能の利用には管理者の設定が必要です。|
| `low_confidence` / `kb_no_match` | 申し訳ございません。該当するFAQが見つかりませんでした。|
| `contact_source_required` | この内容については、お問い合わせフォームよりご連絡ください。|
| その他 | 申し訳ございません。現在回答できません。|

### 1-B. `src/routes/webhookLine.js` — 変更

**追加したハンドラ（既存ハンドラの後に追加）:**

```
メッセージ処理順序:
  1. AI同意 / LLM同意 / AI拒否 / LLM拒否 → continue (Phase Next-4)
  2. 会員ID確認 → continue
  3. 会員ID NN-NNNN → continue
  4. CityPackFeedback → continue
  5. CityRegion (declared/prompt_required) → continue
  6. CityRegion already_set + geographic keyword → continue
  ↓ (ここで fall-through: region=already_set かつ非地理テキスト)
  7. [NEW] FAQ LLM fallback → answerFaqFn() → reply if lineMessage
```

`answerFaqFn` は `options.answerFaqFn` で DI 可能（テスト用）。
デフォルトは `answerFaqForLine`。

---

## 2. LINE FAQ 回答フォーマット

`formatFaqAnswerForLine(result)`:
- `result.faqAnswer.answer`（FAQAnswer.v1 スキーマの `answer` フィールド）を取得
- `result.disclaimer` を末尾に追記（`\n\n` で区切り）
- 合計 1900文字超は `...` でトランケート（LINE の 2000文字制限に対応）

---

## 3. Done/Close 条件

- [x] `answerFaqForLine` が per-user consent を `getUserLlmConsent` でチェックする
- [x] `llmConsentStatus !== 'accepted'` → `user_consent_not_accepted` ブロック + consent 案内
- [x] consent 済みユーザーの質問が `answerFaqFromKb` に委譲される
- [x] `answerFaqFromKb` のブロック応答が LINE 向けメッセージにマップされる
- [x] FAQ 回答は 1900文字でトランケートされる（LINE 制限対応）
- [x] LINE Webhook で未マッチテキストが `answerFaqFn` に渡される（region=already_set の fall-through）
- [x] consent コマンド（AI同意等）は FAQ フォールバックに fall-through しない
- [x] FAQ エラーは catch されて Webhook は 200 を返す（ベストエフォート）
- [x] 890 テスト全グリーン

---

## 4. アーキテクチャメモ

### FAQ ハンドラが reach される条件

LINE Webhook の既存ハンドラ（membership / feedback / region）がすべて `continue` しなかった場合にのみ
FAQ ハンドラに到達する。実運用では:

- **ユーザーの `regionKey` が既に設定済み** の場合、region ハンドラは `already_set` を返し、
  地域キーワード (`/地域|city|state|region/i`) を含まないテキストに対してのみ fall-through する。
- `regionKey` 未設定のユーザーの場合、region ハンドラが `prompt_required` を返し `continue`するため、
  FAQ ハンドラは reach されない。

このため、FAQ 機能は city 登録フロー完了後のユーザーに提供される自然な段階的ロールアウトになっている。

### per-user consent と global policy の関係

- `answerFaqForLine` は **per-user consent** (`user_consents` コレクション) を最初にチェック
- per-user consent がクリアされた後、`answerFaqFromKb` 内で **global policy** (`system_flags.llmPolicy`) もチェックされる
- 両方のゲートをクリアして初めて LLM 回答が生成される（二重ゲート維持）

---

## 5. セキュリティ/プライバシー

| 観点 | 対応 |
|------|------|
| PII | `lineUserId` を `actor` として渡すのみ。質問テキストは `faq_answer_logs` に hash 保存 |
| 同意なし実行の防止 | consent チェックが `answerFaqFromKb` 呼び出しの前に必ず実行される |
| 直接 URL 禁止 | `answerFaqFromKb` 内の `guardLlmOutput` が維持（変更なし） |
| advisory-only | `advisoryOnly: true` スキーマ強制が維持（変更なし） |
| LINE メッセージ長 | 1900文字でトランケート、情報漏洩リスク軽減 |
