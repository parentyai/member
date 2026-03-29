'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const DOC_ROOT = '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_RESOLUTION_CONCIERGE_IMPLEMENTATION';
const REQUIRED_DOCS = [
  '00_start_guard.md',
  '01_input_validation.md',
  '02_current_failure_taxonomy.md',
  '03_concierge_target_state.md',
  '04_architecture_decision.md',
  '05_link_registry_strategy.md',
  '06_task_os_rich_menu_bridge.md',
  '07_resolution_response_contract.json',
  '08_phase1_scope_lock.md',
  '09_shadow_loop_strategy.md',
  '10_eval_and_kpi_plan.md',
  '11_implementation_plan.md',
  '12_changed_files_rationale.md',
  '13_validation_results.md',
  '14_risk_register.md',
  '15_rollback_plan.md',
  '16_exec_summary.md'
];

function read(name) {
  return fs.readFileSync(path.join(DOC_ROOT, name), 'utf8');
}

test('phase910: required implementation artifacts exist and contract json is parseable', () => {
  REQUIRED_DOCS.forEach((file) => {
    assert.equal(fs.existsSync(path.join(DOC_ROOT, file)), true, file);
  });

  const contract = JSON.parse(read('07_resolution_response_contract.json'));
  assert.equal(contract.contract_version, 'resolution_concierge_v1');
  assert.ok(contract.response_contract.official_links);
  assert.ok(contract.response_contract.task_hint);
  assert.ok(contract.response_contract.menu_hint);
});

test('phase910: docs lock phase1 scope and workbook-missing caveat explicitly', () => {
  const startGuard = read('00_start_guard.md');
  const inputValidation = read('01_input_validation.md');
  const scopeLock = read('08_phase1_scope_lock.md');

  assert.match(startGuard, /phase1 scope lock: `enabled`/);
  assert.match(inputValidation, /workbook: missing/);
  assert.match(scopeLock, /ready_after_binding_contract family/);
  assert.match(scopeLock, /ready_after_variant_keying family/);
});
