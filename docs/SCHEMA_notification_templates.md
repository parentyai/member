# SCHEMA_notification_templates

## Collection
`notification_templates`

## Fields
- `key` (string, unique)
- `status` (`draft` | `active` | `inactive`)
- `notificationCategory` (string)
- `title` (string | null)
- `body` (string | null)
- `text` (string | null)
- `ctaText` (string | null)
- `linkRegistryId` (string | null)
- `exceptionPlaybook` (object | null, add-only)
  - `exceptionCode` (string)
  - `domain` (string)
  - `topic` (string)
  - `countryCode` (string)
  - `scopeKey` (string, default `GLOBAL`)
  - `audienceScope` (string[])
  - `householdScope` (string[])
  - `visaScope` (string[])
  - `severity` (`low` | `medium` | `high` | `critical`)
  - `symptomPatterns` (string[])
  - `detectionExpr` (string | null)
  - `summaryMd` (string | null)
  - `bodyMd` (string | null)
  - `fallbackSteps` (string[])
  - `escalationContacts` (object)
  - `authorityFloor` (string)
  - `reviewerStatus` (string)
  - `linkedTaskTemplates` (string[], add-only metadata)
  - `requiredEvidence` (string[], add-only metadata)
  - `likelyCauses` (string[], add-only metadata)
  - `humanReviewRequired` (boolean, add-only metadata)
- `recordEnvelope` (object, add-only mirror)
- `createdAt` (timestamp)
- `updatedAt` (timestamp | null)

## Notes
- `exceptionPlaybook` が存在する template のみ Canonical Core `exception_playbook` sidecar を dual-write する。
- runtime authority は引き続き `notification_templates` 側にある。
- `templates_v` は versioned content store であり、この段階では Canonical Core authority ではない。
