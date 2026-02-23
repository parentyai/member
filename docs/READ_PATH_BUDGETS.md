# READ_PATH_BUDGETS

read path の増悪を CI で停止するための予算定義（add-only）。

## budgets
- worst_case_docs_scan_max: 62000
- fallback_points_max: 40

## policy
- 予算超過は CI fail（増悪のみ停止）。
- 予算以下への改善は pass。
- 予算更新は SSOT 追記 + 実行ログ必須。

## current_baseline_phase350
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- note: 既存 `budgets` は履歴値として保持し、CI評価はこの末尾値を採用する。

## current_baseline_phase355
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- hotspots_count_max: 23
- note: hotspot件数の増悪を停止する ratchet を追加（同等/改善は pass）。

## current_baseline_phase362
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- hotspots_count_max: 23
- note: 収束パッケージ後の最新基準。以後はこの末尾基準をCI評価に採用。

## current_baseline_phase372
- worst_case_docs_scan_max: 20000
- fallback_points_max: 17
- hotspots_count_max: 20
- note: Product-out 収束基準。phase372 以降はこの末尾基準をCI評価に採用。

## current_baseline_phase597
- worst_case_docs_scan_max: 20000
- fallback_points_max: 17
- hotspots_count_max: 20
- unbounded_hotspots_max: 0
- note: listAll callsite の未上限（limit未指定）をゼロ固定。以後は増悪をCIで停止。

## current_baseline_phase584
- worst_case_docs_scan_max: 16000
- fallback_points_max: 17
- hotspots_count_max: 16
- note: phase580-584 の収束基準。docs artifact 一括ゲートと fallbackOnEmpty 制御後の基準値。

## current_baseline_phase586
- worst_case_docs_scan_max: 13000
- fallback_points_max: 17
- hotspots_count_max: 13
- note: phase585-586 の bounded fallback 置換後基準。global listAll fallback の route呼び出しを削減。

## current_baseline_phase590
- worst_case_docs_scan_max: 0
- fallback_points_max: 17
- hotspots_count_max: 0
- note: phase587-590 の収束基準。phase4/phase5/phase2 read-path の listAll hotspot を除去。

## current_baseline_phase594
- worst_case_docs_scan_max: 0
- fallback_points_max: 17
- hotspots_count_max: 0
- missing_index_surface_max: 17
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- note: phase591-594 の fallback risk 可視化基準。missing-index fallback surface の増悪を追加ゲート化。

## current_baseline_phase596
- worst_case_docs_scan_max: 0
- fallback_points_max: 17
- hotspots_count_max: 0
- missing_index_surface_max: 17
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase595-596 の追加基準。snapshot stale / fallback spike の閾値を明示。

## current_baseline_phase597
- worst_case_docs_scan_max: 0
- fallback_points_max: 17
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 17
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase597 の追加基準。listAll callsite の未上限（limit未指定）をゼロ固定。

## current_baseline_phase604
- worst_case_docs_scan_max: 0
- fallback_points_max: 16
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 16
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase604 の収束基準。notificationTemplatesRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase605
- worst_case_docs_scan_max: 0
- fallback_points_max: 15
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 15
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase605 の収束基準。notificationsRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase606
- worst_case_docs_scan_max: 0
- fallback_points_max: 14
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 14
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase606 の収束基準。sendRetryQueueRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase607
- worst_case_docs_scan_max: 0
- fallback_points_max: 13
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 13
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase607 の収束基準。linkRegistryRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase608
- worst_case_docs_scan_max: 0
- fallback_points_max: 12
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 12
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase608 の収束基準。decisionDriftsRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase609
- worst_case_docs_scan_max: 0
- fallback_points_max: 11
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 11
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase609 の収束基準。cityPackTemplateLibraryRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase610
- worst_case_docs_scan_max: 0
- fallback_points_max: 10
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 10
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase610 の収束基準。cityPackUpdateProposalsRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase611
- worst_case_docs_scan_max: 0
- fallback_points_max: 9
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 9
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: phase611 の収束基準。cityPackBulletinsRepo の missing-index fallback を撤去し fallback surface を1段削減。

## current_baseline_phase615
- worst_case_docs_scan_max: 0
- fallback_points_max: 5
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 5
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: batch(phase612-615) の収束基準。cityPackFeedback/cityPackRequests/cityPackMetricsDaily/cityPacks の missing-index fallback を同一PRで撤去し fallback surface を4段削減。

## current_baseline_phase620
- worst_case_docs_scan_max: 0
- fallback_points_max: 0
- hotspots_count_max: 0
- unbounded_hotspots_max: 0
- missing_index_surface_max: 0
- load_risk_freshness_max_hours: 24
- missing_index_surface_freshness_max_hours: 24
- snapshot_stale_ratio_max: 0.5
- fallback_spike_max: 200
- note: batch(phase620) の収束基準。decisionLogs/sourceEvidence/sourceRefs/templatesV/users の missing-index fallback を同一PRで撤去し fallback surface を最終ゼロ化。
