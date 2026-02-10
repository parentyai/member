# SSOT_SERVICE_PHASE_X_PRESET_MATRIX

本ドキュメントは ServicePhase × NotificationPreset の **許可範囲（通知カテゴリ/補助/強さ）**を固定する。
実装は add-only で概念/設定を受け取れるようにするが、未設定時は現状挙動を維持する。

## Matrix Legend
- Allowed Categories: その組み合わせで「出してよい」通知カテゴリ
- Intensity: Preset の強さ（LOW/MEDIUM/HIGH）
- Output Cap: **必ずグローバル上限を尊重**（Preset では上限を解除しない）
- Helper Links: 補助リンク/補助説明を許すか（出すとしても Ops が判断できる形で）

## ServicePhase × Preset Matrix (SSOT)

| ServicePhase | Preset | Allowed Categories | Intensity | Output Cap | Helper Links |
|---:|:---:|:---|:---:|:---|:---:|
| 1 | A | Deadline Required / Immediate Action | LOW | Global cap enforced | ✕ |
| 1 | B | Deadline Required / Immediate Action / Sequence Guidance | MEDIUM | Global cap enforced | △ |
| 1 | C | Deadline Required / Immediate Action / Targeted Only | MEDIUM | Global cap enforced | △ |
| 2 | A | Deadline Required / Immediate Action / Sequence Guidance | LOW | Global cap enforced | △ |
| 2 | B | + Targeted Only | MEDIUM | Global cap enforced | ○ |
| 2 | C | + Completion Confirmation | HIGH | Global cap enforced | ○ |
| 3 | A | Deadline Required / Immediate Action / Sequence Guidance / Targeted Only | LOW | Global cap enforced | ○ |
| 3 | B | + Completion Confirmation | MEDIUM | Global cap enforced | ○ |
| 3 | C | All categories | HIGH | Global cap enforced | ○ |
| 4 | A | All categories | LOW | Global cap enforced | ○ |
| 4 | B | All categories | MEDIUM | Global cap enforced | ○ |
| 4 | C | All categories | HIGH | Global cap enforced | ○ |

Notes:
- Preset は「送る/送らない」の最終決定ではない。Ops の判断・監査・Kill Switch が優先。
- 具体的な数値上限は別 SSOT（または既存の安全ガード）で定義/実装されるまで **Preset で増量しない**。

