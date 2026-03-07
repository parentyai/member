# JOURNEY_COMMAND_SURFACE_V2

Journeyのユーザー向けコマンド文言を内部実装語から切り離して固定する（add-only）。

## Scope
- 対象: `今やる`, `今週の期限`, `カテゴリ`, `相談`
- 非対象: parser action名や内部event typeの改名

## User-facing Contract
- `今やる`
  - 返信は上位3件を返す
  - 各行に `期限` と `カテゴリ` を表示
  - `blockedReason` がある場合は `ブロッカー:<reason>` を表示
- `今週の期限`
  - 返信は次の2セクションで返す
    - `期限（7日以内）`
    - `期限超過`
  - 0件時は `期限（7日以内）/期限超過の未完了タスクはありません。`
- `カテゴリ`
  - 集計行は `カテゴリ: x件（ブロック:y件）`
  - フィルタ表示でも `blockedReason` を表示可能
- `相談`
  - コマンド時点の意味は `案内表示 + 利用イベント記録`
  - チケット作成は行わない

## Internal Mapping (non-user)
- `今やる` -> `next_tasks`
- `今週の期限` -> `due_soon_tasks`
- `カテゴリ` -> `category_view`
- `相談` -> `support_guide`

## Evidence points
- handler: `src/usecases/journey/handleJourneyLineCommand.js`
- parser: `src/domain/journey/lineCommandParsers.js`
- rich menu mapping: `docs/SSOT_LINE_RICH_MENU.md`
