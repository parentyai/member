# SSOT_NOTIFICATION_WAIT_RULES

通知ステップの待機日数の決定方式（Type）と入力値の所在を SSOT として固定する（type-first / add-only）。

## Wait Rule Types（SSOT）
- TYPE_A: 固定日数（integer）
- TYPE_B: イベント基準相対日（baseDate + offset）
- TYPE_C: 状態遷移条件（state-driven）

## StepKey -> Wait Rule Type（Phase0）
| stepKey | waitRuleType | 根拠 |
|---|---|---|
| 3mo | TYPE_B | `docs/SSOT_PHASE0.md:76-110`（出発3か月前） |
| 1mo | TYPE_B | `docs/SSOT_PHASE0.md:76-110`（出発1か月前） |
| week | TYPE_B | `docs/SSOT_PHASE0.md:76-110`（出発週） |
| after1w | TYPE_B | `docs/SSOT_PHASE0.md:76-110`（到着後1週） |

## 入力値の所在（SSOT）
- wait rule の入力値（baseDate / offsetDays）は本書の「Wait Rule Values」表を唯一のSSOTとする（append-only）。
- 値が未入力の場合は `waitRuleConfigured=false` とし、`nextWaitDays=null` とする。
- UIは値未入力時に「未設定（SSOT未入力）」を表示する（既存表示を維持）。
- read-model は `waitRuleType` / `waitRuleConfigured` / `nextWaitDays` / `nextWaitDaysSource` を常に出力する。

## Wait Rule Values（SSOT / TBD）
| stepKey | baseDate | offsetDays | configured |
|---|---|---|---|
| 3mo | TBD | TBD | false |
| 1mo | TBD | TBD | false |
| week | TBD | TBD | false |
| after1w | TBD | TBD | false |

## StepKey -> Wait Rule Type（Phase188B add-only）
| stepKey | waitRuleType | 根拠 |
|---|---|---|
| 2mo | TYPE_B | `docs/SSOT_NOTIFICATION_WAIT_RULES.md:Wait Rule Values (Confirmed)` |
| after1mo | TYPE_B | `docs/SSOT_NOTIFICATION_WAIT_RULES.md:Wait Rule Values (Confirmed)` |

## BaseDate Values（SSOT）
| baseDate | 説明 | 根拠 |
|---|---|---|
| departureDate | 出発日 | `docs/SSOT_PHASE0.md:94-104`（出発前の基準） |

## nextWaitDaysSource（SSOT）
| value | 意味 |
|---|---|
| ssot_unset | SSOTの値未入力により算出不可 |
| ssot_value | SSOTの値（offsetDays）により算出 |

## Wait Rule Values（SSOT / Confirmed 2026-02-16）
以下の表は「Wait Rule Values（SSOT / TBD）」を上書きする（append-only）。

| stepKey | baseDate | offsetDays | configured |
|---|---|---|---|
| 3mo | departureDate | -90 | true |
| 2mo | departureDate | -60 | true |
| 1mo | departureDate | -30 | true |
| week | departureDate | -7 | true |
| after1w | departureDate | 7 | true |
| after1mo | departureDate | 30 | true |
