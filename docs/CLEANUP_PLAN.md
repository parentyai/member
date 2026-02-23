# CLEANUP_PLAN

## 目的
- 削除ではなく、構造整流・負債可視化・可逆整理を実施する。
- add-onlyで legacy/duplicate/fallback/full-scan/drift を制御可能にする。

## 対象
- canonical repos: 22
- legacy repos: 6
- duplicate groups: 6
- missing-index fallback points: 14
- full-scan hotspots: 0
- lifecycle collections: 45
- unreachable frozen targets: 20

## 実施フェーズ
1. Canonicalizationコメント統一（LEGACY_HEADER/LEGACY_ALIAS）
2. INDEX/FULL_SCAN/NAMING_DRIFT 設計書固定
3. retention addendum と lifecycle同期
4. unreachable file 凍結コメント追加
5. CIチェック追加（cleanup:check）

## 互換性
- API仕様/Firestoreスキーマ/ルート契約は変更しない。
- 既存挙動は不変。
