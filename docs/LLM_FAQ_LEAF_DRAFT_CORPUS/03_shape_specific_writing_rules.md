# 03 Shape-Specific Writing Rules

- generation_mode: `SAFE_ONLY`
- 原則: current source block と manifest constraint を下敷きにし、未観測事実を追加しない

## plain_text_answer
- 1目的の単一メッセージに限定
- 2〜5文相当の shell を維持
- 追加の制度説明や CTA を足さない

## ranked_answer_with_candidates
- SAFE_ONLY では生成対象なし

## disclaimer_block
- 助言限界だけを簡潔に示す
- 怖がらせる表現は足さない

## fallback_text
- 答えられない理由と再入力方向だけを保持
- 新しい原因説明や upsell を足さない

## clarify_prompt
- 必要情報の確認だけに絞る
- 取得不能な情報は要求しない

## refuse_text
- 安全上の断定回避だけを示す
- 新しい法務・制度判断を足さない

## consent_ack
- 同意状態の確認のみ
- 長文化しない

## command_ack
- 受理・状態反映のみ
- 新しい導線や副作用を約束しない

## flex_label_set
- ラベルのみ
- 説明文へ展開しない

## flex_button_set
- ボタン文言のみ
- action 数や action 名を増やさない

## reminder_text
- SAFE_ONLY では生成対象外

## notification_text
- body または CTA join placeholder のみ
- URL・CTA 数を創作しない

## renderer_default_text
- render fallback としてのみ成立させる
- domain-specific detail を足さない

## welcome_text
- 初回導入メッセージのみ
- 機能羅列しない

## operator_notification_text
- SAFE_ONLY では生成対象外

## unknown_shape
- 通常生成禁止
- deferred または excluded へ分離
