# 09 Counterexamples

## 1. generate leaf だから無条件に生成する
- 誤った判断: `leaf_status=generate` だけで draft を作る
- なぜ誤りか: mixed audience / human review gate / unknown_shape が残る葉がある
- どう検出するか: `08_leaf_to_generation_scope.csv` と `10_test_anchor_matrix.md` を照合する
- 今回どう防いだか: `generation_allowed=true` かつ `human_review_required=false` かつ `output_shape!=unknown_shape` を必須にした

## 2. unknown_shape を通常生成する
- 誤った判断: shape 不明でも text を書いてしまう
- なぜ誤りか: HTTP CTA 配列や altText fallback を text shape に誤変換する
- どう検出するか: `surface_scope.output_shape == unknown_shape`
- 今回どう防いだか: unknown_shape は deferred または excluded に送った

## 3. human review gate を無視する
- 誤った判断: review gate 付き leaf も SAFE_ONLY で書く
- なぜ誤りか: wording drift と claim boundary を repo 側で担保できない
- どう検出するか: `human_review_required=true` または `test_anchors_missing` に `human_review_gate`
- 今回どう防いだか: すべて deferred_review に分離した

## 4. same-copy 誘惑で隣接 leaf をまとめる
- 誤った判断: webhook clarify と paid clarify を 1 draft にする
- なぜ誤りか: route responsibility と downstream contract が違う
- どう検出するか: `parent_g3_unit_id` と `primary_route` の差分を見る
- 今回どう防いだか: 1 leaf = 1 draft を維持し、`must_not_merge_with` をまたがない

## 5. prohibited_claims を軽視する
- 誤った判断: 法務・税務・資格判断を補って書く
- なぜ誤りか: manifest にない事実を追加してしまう
- どう検出するか: draft と `prohibited_claims` / `must_not_generate` を突合する
- 今回どう防いだか: current source block と manifest constraints のみを使い、optional facts も未使用に固定した

## 6. isolate leaf を normal corpus に混ぜる
- 誤った判断: reminder や ops escalation を end-user normal corpus に入れる
- なぜ誤りか: audience leak と adjacent runtime が隠れる
- どう検出するか: `leaf_status=isolate_for_human_or_separate_policy`
- 今回どう防いだか: excluded queue に分離した

## 7. quick reply 未観測を不要扱いする
- 誤った判断: quick reply slot を消してよいと解釈する
- なぜ誤りか: not observed は不要の証拠ではない
- どう検出するか: `leaf_future_quick_reply_surface_slot` の status を確認する
- 今回どう防いだか: unknown leaf として excluded queue に残し、生成しなかった
