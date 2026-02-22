# Phase582 Plan

## Goal
phase4/phase5 の scoped-first 配線を整理し、重複した `listAll*` fallback 呼び出しを統合する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/usecases/admin/getUserOperationalSummary.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/phase5/getUserStateSummary.js`
- `/Users/parentyai.com/Projects/Member/tests/phase582/*`
- `/Users/parentyai.com/Projects/Member/docs/INDEX_REQUIREMENTS.md`（必要時 add-only）

## Non-Goals
- Firestore スキーマ変更
- route 契約の破壊的変更

## Contract
- `fallbackMode=block` で global fallback 停止
- `fallbackMode=allow` でも条件一致時のみ fallback
- 診断メタは既存キーを維持

## Acceptance
- `listAllEvents` / `listAllNotificationDeliveries` の重複呼び出しが統合される
- 既存メタ契約（fallbackUsed/fallbackBlocked/fallbackSources）を維持

