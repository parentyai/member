# 14 Risk Register

## Core Risks
- `draft_ready` を `apply-ready` と誤認すると placeholder / shell / variant がそのまま露出する。
- `structured_blocks` を key 無しで 1 文面に潰すと consent / direct command / renderer state が逆転する。
- `label: url` や bare `-` を final copy と見なすと renderer fallback syntax を user-facing 文言として固定してしまう。
- exact-string anchor 不足を無視すると、apply 後 drift を検知しにくい。

## Counterexamples
### 1. generated draft だからそのまま apply できる
- 誤った判断: generated draft だからそのまま apply できる
- なぜ誤りか: `leaf_notification_body_default` は generated でも body fallback `-` です。
- どう検出するか: `normalizeBody()` の fallback と draft payload を照合する。
- 今回の apply gate でどう防ぐか: `blocked_apply` に残し、safe set から除外した。

### 2. `<url>` や `<title>` を literal と誤認する
- 誤った判断: `<url>` や `<title>` を literal と誤認する
- なぜ誤りか: `leaf_line_renderer_deeplink_with_url` と `leaf_free_retrieval_empty_reply` は runtime binding 前提です。
- どう検出するか: placeholder inventory と binding contract を確認する。
- 今回の apply gate でどう防ぐか: `parameterized_apply_candidate` として別扱いにした。

### 3. `...` shell を final copy と誤認する
- 誤った判断: `...` shell を final copy と誤認する
- なぜ誤りか: free style 5 leaf は semantic fill 未完了です。
- どう検出するか: ellipsis token を検出する。
- 今回の apply gate でどう防ぐか: `copy_shell_only` に固定した。

### 4. structured_blocks を key なしで 1 文字列扱いする
- 誤った判断: structured_blocks を key なしで 1 文字列扱いする
- なぜ誤りか: consent / direct command / region / service ack が state 別に壊れる。
- どう検出するか: variant keying spec で alternate block を観測する。
- 今回の apply gate でどう防ぐか: `keyed_variant_candidate` として apply を止めた。

### 5. `-` や `label: url` を user-ready copy と誤認する
- 誤った判断: `-` や `label: url` を user-ready copy と誤認する
- なぜ誤りか: renderer/notification format placeholder を final corpus に昇格させる。
- どう検出するか: notification builder 実装を確認する。
- 今回の apply gate でどう防ぐか: `blocked_apply` 理由に `format_placeholder_only` を入れた。

### 6. placeholder source 未確定のまま apply する
- 誤った判断: placeholder source 未確定のまま apply する
- なぜ誤りか: `<内容>` は literal example か binding token か未確定です。
- どう検出するか: binding contract で `observed_in_repo=false` を見る。
- 今回の apply gate でどう防ぐか: `copy_shell_only` とし、missing binding question に残した。

### 7. weak test anchor を無視して apply する
- 誤った判断: weak test anchor を無視して apply する
- なぜ誤りか: literal text でも exact-string drift を検知できない。
- どう検出するか: test anchor matrix を確認する。
- 今回の apply gate でどう防ぐか: safe minimum apply set を 0 件に据え置いた。

