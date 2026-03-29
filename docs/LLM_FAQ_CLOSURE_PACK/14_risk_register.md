# 14 Risk Register

## Counterexamples
### 1. `draft_ready` を `Codex-only closure 可能` と誤認する
- 誤った判断: `draft_ready` を `Codex-only closure 可能` と誤認する
- なぜ誤りか: draft_ready は wording self-check であり binding / variant / test freeze を含みません。
- どう検出するか: apply partition と closure class を比較する。
- 今回の closure pack でどう防ぐか: closure class を A/B/C/D/E に分離した。

### 2. binding source 未凍結の token をそのまま apply に進める
- 誤った判断: binding source 未凍結の token をそのまま apply に進める
- なぜ誤りか: `<title>` / `<url>` / `<phaseCommand>` などが literal 化誤りを起こす。
- どう検出するか: binding contract records を確認する。
- 今回の closure pack でどう防ぐか: binding source 観測済みでも closure class を分けた。

### 3. shell text を GPT 再生成不要と誤認する
- 誤った判断: shell text を GPT 再生成不要と誤認する
- なぜ誤りか: `...` や `<pitfall>/<gap>` は final wording ではない。
- どう検出するか: placeholder inventory と GPT pack を確認する。
- 今回の closure pack でどう防ぐか: shell leaves を `gpt_reauthoring_required` に隔離した。

### 4. exact-string anchor 不足を軽視する
- 誤った判断: exact-string anchor 不足を軽視する
- なぜ誤りか: apply-ready 判定後の drift を止められない。
- どう検出するか: test anchor matrix と apply gate の `ready_literal_now=0` を照合する。
- 今回の closure pack でどう防ぐか: codex_test_anchor_closure_candidate として tests を先に閉じる。

### 5. variant key 不在のまま labels/buttons を apply する
- 誤った判断: variant key 不在のまま labels/buttons を apply する
- なぜ誤りか: state や slot が逆転する。
- どう検出するか: variant spec と task flex / consent branches を確認する。
- 今回の closure pack でどう防ぐか: variant_key_anchor と human freeze を分離した。

### 6. `<pitfall>` / `<gap>` を推測で literalize する
- 誤った判断: `<pitfall>` / `<gap>` を推測で literalize する
- なぜ誤りか: semantic source が drift し、paid shell ownership を壊す。
- どう検出するか: binding contract と GPT pack の required decisions を見る。
- 今回の closure pack でどう防ぐか: paid conversation shell を GPT pack、paid reply guard omit policy を human freeze に分けた。

### 7. `label: url` や `-` を final copy と誤認する
- 誤った判断: `label: url` や `-` を final copy と誤認する
- なぜ誤りか: renderer format placeholder を end-user literal に固定してしまう。
- どう検出するか: notification builder 実装と apply gate blocked reasons を照合する。
- 今回の closure pack でどう防ぐか: notification 2 leaf を human/policy freeze required に残した。

