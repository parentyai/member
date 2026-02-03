# Phase20 Execution Log

## 追記ルール
- UTC必須
- 事実のみ
- 推論は別セクションに分離

## 事実ログ
- UTC: 2026-02-03T04:28:27.547Z
  - Script: scripts/phase20_cta_ab_stats.js
  - Conditions: ctaTextA="open", ctaTextB="open"
  - Output: {"utc":"2026-02-03T04:28:27.547Z","projectId":"member-485303","ctaTextA":"open","ctaTextB":"open","sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}
- UTC: 2026-02-03T04:53:19.653Z
  - Script: scripts/phase20_cta_ab_stats.js
  - Conditions: ctaTextA="openA", ctaTextB="openB", fromUtc="2026-02-03T00:00:00Z", toUtc="2026-02-04T00:00:00Z"
  - Output: {"utc":"2026-02-03T04:53:19.653Z","projectId":"member-485303","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-03T00:00:00Z","toUtc":"2026-02-04T00:00:00Z","filterField":null,"sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}
- UTC: 2026-02-03T15:18:27.540Z
  - LinkRegistry: linkRegistryId="yOIE1l86ak1AVULB79xJ", url="https://example.com"
  - Notifications: notificationIdA="GCwbGqnmDfQvKtZhSIyj" (ctaText="openA"), notificationIdB="4PTArpmCxkcHDVmBzIs1" (ctaText="openB")
  - test-send: attemptsA=10 (HTTP 200 count=10), attemptsB=10 (HTTP 200 count=10)
  - Deliveries: deliveryIdA="4HUqNnNDA9WRwHWI28po", deliveryIdB="h8gKda9VjySeuXs1uBGg"
  - track/click: clickA httpStatus=403 (saved to /tmp/phase20_click_A.log), clickB httpStatus=403 (saved to /tmp/phase20_click_B.log)
  - Script: scripts/phase20_cta_ab_stats.js
  - Command: node scripts/phase20_cta_ab_stats.js "openA" "openB" "2026-02-03T00:00:00Z" "2026-02-04T00:00:00Z"
  - Output: {"utc":"2026-02-03T15:18:27.540Z","projectId":"member-485303","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-03T00:00:00Z","toUtc":"2026-02-04T00:00:00Z","filterField":null,"sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}

## 推論ログ
