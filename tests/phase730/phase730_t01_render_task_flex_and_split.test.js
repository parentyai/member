'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { renderTaskFlexMessage, buildTimeLabel } = require('../../src/usecases/tasks/renderTaskFlexMessage');
const { splitLineLongText } = require('../../src/usecases/line/splitLineLongText');

test('phase730: buildTimeLabel formats min/max and fallback', () => {
  assert.equal(buildTimeLabel(20, 40), '20〜40分');
  assert.equal(buildTimeLabel(15, null), '15分');
  assert.equal(buildTimeLabel(null, 30), '30分');
  assert.equal(buildTimeLabel(null, null), '未登録');
});

test('phase730: renderTaskFlexMessage renders checklist, understanding actions, and CTA', () => {
  const message = renderTaskFlexMessage({
    todoKey: 'bank_open',
    task: { ruleId: 'bank_open', meaning: { title: '銀行口座を作る' } },
    taskContent: {
      title: '銀行口座を作る',
      timeMin: 20,
      timeMax: 40,
      checklistItems: [
        { id: 'passport', text: 'パスポート準備', order: 1, enabled: true },
        { id: 'ssn', text: 'SSNまたはITIN確認', order: 2, enabled: true },
        { id: 'reserve', text: '銀行予約', order: 3, enabled: true },
        { id: 'addr', text: '住所確認', order: 4, enabled: true },
        { id: 'phone', text: '電話番号確認', order: 5, enabled: true },
        { id: 'memo', text: '相談事項メモ', order: 6, enabled: true }
      ]
    },
    linkRefs: {
      video: {
        ok: true,
        link: { url: 'https://www.youtube.com/watch?v=abc123' }
      },
      action: {
        ok: true,
        link: { url: 'https://www.usbank.com/checking-accounts.html', title: 'US Bankで口座開設' }
      }
    }
  });

  assert.equal(message.type, 'flex');
  assert.equal(message.contents.type, 'bubble');
  const body = message.contents.body.contents;
  const bodyTexts = body.filter((item) => item && item.type === 'text').map((item) => item.text);
  assert.ok(bodyTexts.includes('必要時間'));
  assert.ok(bodyTexts.includes('20〜40分'));
  assert.ok(bodyTexts.includes('やること'));
  assert.ok(bodyTexts.includes('□ パスポート準備'));
  assert.ok(bodyTexts.includes('…ほか1件'));

  const understandingBox = body.find((item) => item && item.type === 'box' && Array.isArray(item.contents));
  assert.ok(understandingBox);
  const labels = understandingBox.contents.map((item) => item && item.action && item.action.label).filter(Boolean);
  assert.deepEqual(labels, ['📖 手順マニュアル', '🎥 3分動画', '⚠ よくある失敗']);

  assert.ok(message.contents.footer);
  const cta = message.contents.footer.contents[0];
  assert.equal(cta.action.label, '→ US Bankで口座開設');
});

test('phase730: splitLineLongText splits long text safely and preserves non-empty chunks', () => {
  const paragraph = 'A'.repeat(2100);
  const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
  const chunks = splitLineLongText(text, 4200);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((item) => item.length <= 4200));
  assert.ok(chunks.every((item) => item.trim().length > 0));
});
