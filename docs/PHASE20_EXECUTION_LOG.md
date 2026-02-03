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
- UTC: 2026-02-03T15:58:19.157Z
  - LinkRegistry: linkRegistryId="B5cCN5yslidhJzPHNL3k", url="https://example.com"
  - Notifications: notificationIdA="Tx9ndqE2vurRXLr9J4M9" (ctaText="openA"), notificationIdB="dGrkHXReMjZM5ydR4GsI" (ctaText="openB")
  - test-send: attemptsA=10, attemptsB=10
  - Deliveries: deliveryIdA="OU2ObGXA4L90xM1Nbrtt", deliveryIdB="mJI2Xo0e8PmCvNSAbVWi"
  - track/click: clickA httpStatus=403 (saved to /tmp/phase20_click_A.log), clickB httpStatus=403 (saved to /tmp/phase20_click_B.log)
  - Script: scripts/phase20_cta_ab_stats.js
  - Command: node scripts/phase20_cta_ab_stats.js "openA" "openB" "2026-02-03T00:00:00Z" "2026-02-04T00:00:00Z"
  - Output: {"utc":"2026-02-03T15:58:19.157Z","projectId":"member-485303","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-03T00:00:00Z","toUtc":"2026-02-04T00:00:00Z","filterField":null,"sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}
- UTC: 2026-02-03T17:16:03.174Z
  - LinkRegistry: linkRegistryId="wKr9J9x40U1q3bI2HTmT", url="https://example.com"
  - Notifications: notificationIdA="BfuRnwZtlkDvzxqmCXIa" (ctaText="openA"), notificationIdB="S2XLX8rqF8pxSqYSQt3C" (ctaText="openB")
  - test-send: attemptsA=10, attemptsB=10
  - Deliveries: deliveryIdA="eMKz7gnT7WfsDrEKztz2", deliveryIdB="vvago2nmzAqYUC5TFfV7"
  - track/click: clickA httpStatus=403 (saved to /tmp/phase20_click_A.log), clickB httpStatus=403 (saved to /tmp/phase20_click_B.log)
  - Script: scripts/phase20_cta_ab_stats.js
  - Command: node scripts/phase20_cta_ab_stats.js "openA" "openB" "2026-02-03T00:00:00Z" "2026-02-04T00:00:00Z"
  - Output: {"utc":"2026-02-03T17:16:03.174Z","projectId":"member-485303","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-03T00:00:00Z","toUtc":"2026-02-04T00:00:00Z","filterField":null,"sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}
- UTC: 2026-02-03T17:38:50.800Z
  - LinkRegistry: linkRegistryId="c5JfFu6bBqhbLtw32KLF", url="https://example.com"
  - Notifications: notificationIdA="G6XWq1bLMSGw2Ullaa5q" (ctaText="openA"), notificationIdB="P07VoWrZyeEHhTLJAPck" (ctaText="openB")
  - test-send: attemptsA=10, attemptsB=10
  - Deliveries: deliveryIdA="wa1naEZ2vTYKbqHsK6Os", deliveryIdB="R2tzbhtROkuQuvyzs0E7"
  - track/click: clickA httpStatus=403 (saved to /tmp/phase20_click_A.log), clickB httpStatus=403 (saved to /tmp/phase20_click_B.log)
  - Script: scripts/phase20_cta_ab_stats.js
  - Command: node scripts/phase20_cta_ab_stats.js "openA" "openB" "2026-02-03T00:00:00Z" "2026-02-04T00:00:00Z"
  - Output: {"utc":"2026-02-03T17:38:50.800Z","projectId":"member-485303","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-03T00:00:00Z","toUtc":"2026-02-04T00:00:00Z","filterField":null,"sentCountA":0,"clickCountA":0,"sentCountB":0,"clickCountB":0,"scannedDocs":0}

## 推論ログ
