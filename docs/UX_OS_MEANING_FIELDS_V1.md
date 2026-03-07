# UX_OS_MEANING_FIELDS_V1

Task meaning fields contract hardening (add-only).

## Scope
- `task_contents`
- Task Detail renderer (`renderTaskFlexMessage`)

## Meaning Priority (`whyNow`)
Task Detailで表示する `whyNow` は以下優先順で解決する。
1. `task_contents.whyNow`
2. `tasks.meaning.whyNow`
3. `tasks.whyNow`
4. fallback文言（固定）

## Data Contract
`task_contents` normalize は add-only で `whyNow` を保持する。

```json
{
  "taskKey": "bank_open",
  "title": "銀行口座を作る",
  "whyNow": "初月の生活基盤を整えるため",
  "summaryShort": [],
  "topMistakes": [],
  "contextTips": []
}
```

## Compatibility
- `whyNow` 未設定ドキュメントは従来どおり読取可能。
- `renderTaskFlexMessage` は既存 fallback chain を維持する。
- 既存 `manualText` / `failureText` / continuation UX は変更しない。

## Evidence
- `src/repos/firestore/taskContentsRepo.js`
- `src/usecases/tasks/renderTaskFlexMessage.js`
