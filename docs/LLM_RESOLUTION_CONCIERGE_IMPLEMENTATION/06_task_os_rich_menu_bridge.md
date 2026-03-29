# 06 Task OS Rich Menu Bridge

## Existing command truth reused

- `今やる` -> `next_tasks`
- `今週の期限` -> `due_soon_tasks`
- `地域手続き` -> `regional_procedures`
- `TODO一覧` -> `todo_list`
- `通知履歴` -> `delivery_history`
- `相談` -> `support_guide`

## Bridge rule

- menu hint is returned only when the response is taskable or blocked
- quick reply payload reuses existing command text
- no direct Rich Menu URL is embedded

## Priority order

1. due-driven turn -> `今週の期限`
2. regional or jurisdiction turn -> `地域手続き`
3. welcome entry -> `TODO一覧`
4. taskable turn -> `今やる`
5. refusal / blocker-heavy turn -> `相談`
