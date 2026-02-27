# SSOT_ADMIN_UI_ROUTES_V2

`/admin/*` 実行導線の統合契約（add-only）。

## Purpose
- 管理UIの実行面を `/admin/app` に一本化する。
- legacy HTML は削除せず互換資産として保持する。
- 既定動作は redirect（302）で統一し、旧導線の二重運用を防ぐ。

## Compat Policy
- `compat=1`（または `stay_legacy=1`）は緊急避難専用。
- 既定は redirect。legacy HTML 配信は `role=admin|developer` かつ `confirm=<ADMIN_UI_COMPAT_CONFIRM_TOKEN>` 一致時のみ許可。
- `confirm` 未設定または不一致時は必ず `/admin/app` 側へ redirect する。

<!-- ADMIN_UI_ROUTES_V2_BEGIN -->
[
  {
    "route": "/admin/app",
    "type": "app_shell",
    "pane": "home",
    "legacy_source": "apps/admin/app.html",
    "notes": "canonical shell"
  },
  {
    "route": "/admin/ops",
    "type": "redirect_to_app_pane",
    "pane": "home",
    "legacy_source": "apps/admin/ops_readonly.html",
    "notes": "ops entry"
  },
  {
    "route": "/admin/ops_readonly",
    "type": "redirect_to_app_pane",
    "pane": "home",
    "legacy_source": "apps/admin/ops_readonly.html",
    "notes": "legacy alias"
  },
  {
    "route": "/admin/composer",
    "type": "redirect_to_app_pane",
    "pane": "composer",
    "legacy_source": "apps/admin/composer.html",
    "notes": "composer pane"
  },
  {
    "route": "/admin/monitor",
    "type": "redirect_to_app_pane",
    "pane": "monitor",
    "legacy_source": "apps/admin/monitor.html",
    "notes": "monitor pane"
  },
  {
    "route": "/admin/errors",
    "type": "redirect_to_app_pane",
    "pane": "errors",
    "legacy_source": "apps/admin/errors.html",
    "notes": "errors pane"
  },
  {
    "route": "/admin/read-model",
    "type": "redirect_to_app_pane",
    "pane": "read-model",
    "legacy_source": "apps/admin/read_model.html",
    "notes": "read-model pane"
  },
  {
    "route": "/admin/master",
    "type": "redirect_to_app_pane",
    "pane": "maintenance",
    "legacy_source": "apps/admin/master.html",
    "notes": "master to maintenance"
  },
  {
    "route": "/admin/review",
    "type": "redirect_to_app_pane",
    "pane": "audit",
    "legacy_source": "apps/admin/review.html",
    "notes": "review to audit"
  }
]
<!-- ADMIN_UI_ROUTES_V2_END -->

## Runtime Link
- runtime定義: `src/shared/adminUiRoutesV2.js`
- redirect実装: `src/index.js` (`handleAdminUiRoute`)
- docs整合検証: `tools/verify_docs.js`
