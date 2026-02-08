# RUNBOOK_cursor_signing

## Purpose
Ops console list の cursor を署名し改ざんを防止する。

## Steps
1. list response の cursorInfo.signedCursor を確認する。
2. request の cursor を使う場合は署名済みであることを確認する。
3. invalid cursor は 400 で reject されることを確認する。

## Rollback
- 実装PRを revert する。
