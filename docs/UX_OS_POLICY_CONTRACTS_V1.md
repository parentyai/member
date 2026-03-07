# UX_OS_POLICY_CONTRACTS_V1

Journey / Reminder policy contract hardening (add-only).

## Scope
- `opsConfig/journeyPolicy`
- `journeyPolicy.notificationCaps`
- reminder quiet-hours guard (`runJourneyTodoReminderJob`)

## Canonical Shape
```json
{
  "enabled": false,
  "reminder_offsets_days": [7, 3, 1],
  "reminder_max_per_run": 200,
  "paid_only_reminders": true,
  "notificationCaps": {
    "perUserWeeklyCap": null,
    "perUserDailyCap": null,
    "perCategoryWeeklyCap": null,
    "quietHours": null
  },
  "rich_menu_enabled": false,
  "schedule_required_for_reminders": true,
  "rich_menu_map": {
    "free_default": "",
    "pro_single": "",
    "pro_couple": "",
    "pro_accompany1": "",
    "pro_accompany2": ""
  },
  "auto_upgrade_message_enabled": true,
  "auto_downgrade_message_enabled": true
}
```

## Backward Compatibility (normalize only)
`normalizeJourneyPolicy` は以下の legacy 入力を `notificationCaps` へ吸収する。
- `notification_caps` (snake_case)
- `quietHours` (top-level)
- `quiet_hours` (top-level)
- `per_user_weekly_cap` / `per_user_daily_cap` / `per_category_weekly_cap`

不正値は `normalizeJourneyPolicy` で `null` 判定となり、保存は拒否される。

## quietHours Contract
- `quietHours.startHourUtc` / `quietHours.endHourUtc` は 0..23 の整数。
- `startHourUtc === endHourUtc` は不正。
- reminder narrowing 時は `journeyPolicy.notificationCaps.quietHours` を優先して判定する。

## Plan/Set Contract
- `journey-policy/plan` の `planHash` は `notificationCaps` を含めて計算する。
- これにより、`notificationCaps` 変更時は confirm token が再生成される。

## Evidence
- `src/repos/firestore/journeyPolicyRepo.js`
- `src/routes/admin/journeyPolicyConfig.js`
- `src/usecases/journey/runJourneyTodoReminderJob.js`
