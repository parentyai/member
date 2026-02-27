# SSOT_ADMIN_UI_MASTER_TABLE_V1

Admin UI の危険操作フローを定義する単一SSOT（add-only）。

## Purpose
- `ADMIN_UI_MASTER_DEFINITION_TABLE` を docs JSON ブロックとして固定し、runtime はこの定義のみを参照する。
- 危険操作の guard / evidence / role 制約を flow 単位で宣言する。

## Source of Truth
- 本ファイルの `ADMIN_UI_MASTER_TABLE` JSON ブロックのみを真実源とする。
- runtime は `src/domain/managedFlowRegistry.js` から本ブロックを読み込む。

<!-- ADMIN_UI_MASTER_TABLE_BEGIN -->
{
  "version": "2026-02-27.v1.1",
  "flows": [
    {
      "flowId": "composer.notification.approve_plan",
      "stateMachine": {
        "initial": "draft",
        "transitions": [
          { "event": "approve", "from": "draft", "to": "approved" },
          { "event": "plan", "from": "approved", "to": "planned" }
        ]
      },
      "guardRules": {
        "actorMode": "required",
        "traceMode": "required",
        "confirmMode": "none",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "notifications.approve",
          "method": "POST",
          "pathPattern": "/api/admin/os/notifications/approve",
          "dangerClass": "approve",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "notifications.send.plan",
          "method": "POST",
          "pathPattern": "/api/admin/os/notifications/send/plan",
          "dangerClass": "send_plan",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["notifications.approve", "notifications.send.plan"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer"],
        "deny": ["operator"]
      }
    },
    {
      "flowId": "composer.notification.execute",
      "stateMachine": {
        "initial": "planned",
        "transitions": [
          { "event": "execute", "from": "planned", "to": "sent" }
        ]
      },
      "guardRules": {
        "actorMode": "required",
        "traceMode": "required",
        "confirmMode": "required",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "notifications.send.execute",
          "method": "POST",
          "pathPattern": "/api/admin/os/notifications/send/execute",
          "dangerClass": "execute",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["notifications.send.execute"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer"],
        "deny": ["operator"]
      }
    },
    {
      "flowId": "city_pack.bulletin.write",
      "stateMachine": {
        "initial": "draft",
        "transitions": [
          { "event": "approve", "from": "draft", "to": "approved" },
          { "event": "send", "from": "approved", "to": "sent" },
          { "event": "reject", "from": "draft", "to": "rejected" }
        ]
      },
      "guardRules": {
        "actorMode": "allow_fallback",
        "traceMode": "required",
        "confirmMode": "none",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "city_pack.bulletin.create",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-bulletins",
          "dangerClass": "create",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.bulletin.approve",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-bulletins/:bulletinId/approve",
          "dangerClass": "approve",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.bulletin.reject",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-bulletins/:bulletinId/reject",
          "dangerClass": "reject",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.bulletin.send",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-bulletins/:bulletinId/send",
          "dangerClass": "send",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["city_pack.bulletin.create", "city_pack.bulletin.approve", "city_pack.bulletin.reject", "city_pack.bulletin.send"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer", "operator"],
        "deny": []
      }
    },
    {
      "flowId": "city_pack.request.write",
      "stateMachine": {
        "initial": "requested",
        "transitions": [
          { "event": "approve", "from": "requested", "to": "approved" },
          { "event": "activate", "from": "approved", "to": "active" },
          { "event": "reject", "from": "requested", "to": "rejected" },
          { "event": "request_changes", "from": "requested", "to": "needs_review" },
          { "event": "retry_job", "from": "needs_review", "to": "requested" }
        ]
      },
      "guardRules": {
        "actorMode": "allow_fallback",
        "traceMode": "required",
        "confirmMode": "none",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "city_pack.request.approve",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-requests/:requestId/approve",
          "dangerClass": "approve",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.request.reject",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-requests/:requestId/reject",
          "dangerClass": "reject",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.request.request_changes",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-requests/:requestId/request-changes",
          "dangerClass": "request_changes",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.request.retry_job",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-requests/:requestId/retry-job",
          "dangerClass": "retry",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "city_pack.request.activate",
          "method": "POST",
          "pathPattern": "/api/admin/city-pack-requests/:requestId/activate",
          "dangerClass": "activate",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["city_pack.request.approve", "city_pack.request.reject", "city_pack.request.request_changes", "city_pack.request.retry_job", "city_pack.request.activate"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer", "operator"],
        "deny": []
      }
    },
    {
      "flowId": "vendors.write",
      "stateMachine": {
        "initial": "unknown",
        "transitions": [
          { "event": "edit", "from": "*", "to": "updated" },
          { "event": "activate", "from": "*", "to": "enabled" },
          { "event": "disable", "from": "*", "to": "disabled" }
        ]
      },
      "guardRules": {
        "actorMode": "required",
        "traceMode": "required",
        "confirmMode": "none",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "vendors.edit",
          "method": "POST",
          "pathPattern": "/api/admin/vendors/:linkId/edit",
          "dangerClass": "edit",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "vendors.activate",
          "method": "POST",
          "pathPattern": "/api/admin/vendors/:linkId/activate",
          "dangerClass": "activate",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "vendors.disable",
          "method": "POST",
          "pathPattern": "/api/admin/vendors/:linkId/disable",
          "dangerClass": "disable",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["vendors.edit", "vendors.activate", "vendors.disable"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer", "operator"],
        "deny": []
      }
    },
    {
      "flowId": "emergency.write",
      "stateMachine": {
        "initial": "draft",
        "transitions": [
          { "event": "provider_update", "from": "*", "to": "configured" },
          { "event": "provider_force_refresh", "from": "configured", "to": "synced" },
          { "event": "bulletin_approve", "from": "draft", "to": "approved" },
          { "event": "bulletin_reject", "from": "draft", "to": "rejected" }
        ]
      },
      "guardRules": {
        "actorMode": "required",
        "traceMode": "required",
        "confirmMode": "none",
        "killSwitchCheck": "none",
        "auditMode": "required"
      },
      "writeActions": [
        {
          "actionKey": "emergency.provider.update",
          "method": "POST",
          "pathPattern": "/api/admin/emergency/providers/:providerKey",
          "dangerClass": "provider_update",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "emergency.provider.force_refresh",
          "method": "POST",
          "pathPattern": "/api/admin/emergency/providers/:providerKey/force-refresh",
          "dangerClass": "provider_force_refresh",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "emergency.bulletin.approve",
          "method": "POST",
          "pathPattern": "/api/admin/emergency/bulletins/:bulletinId/approve",
          "dangerClass": "approve",
          "workbenchZoneRequired": true
        },
        {
          "actionKey": "emergency.bulletin.reject",
          "method": "POST",
          "pathPattern": "/api/admin/emergency/bulletins/:bulletinId/reject",
          "dangerClass": "reject",
          "workbenchZoneRequired": true
        }
      ],
      "evidenceBindings": {
        "auditActionHints": ["emergency.provider.update", "emergency.provider.force_refresh", "emergency.bulletin.approve", "emergency.bulletin.reject"],
        "defaultPane": "audit"
      },
      "roleRestrictions": {
        "allow": ["admin", "developer", "operator"],
        "deny": []
      }
    }
  ]
}
<!-- ADMIN_UI_MASTER_TABLE_END -->
