#!/usr/bin/env node
'use strict';

/**
 * db_migrate_kb_required_fields.js
 *
 * Migrates existing faq_articles documents to have required fields:
 *   - riskLevel: 'low'   (if missing)
 *   - allowedIntents: [] (if missing — means "all intents allowed")
 *   - version: '1.0.0'   (if missing)
 *
 * validUntil is intentionally NOT set automatically because it requires
 * a human decision about article expiry. Run with --dry-run first.
 *
 * Usage:
 *   node tools/db_migrate_kb_required_fields.js --dry-run   # preview
 *   node tools/db_migrate_kb_required_fields.js --apply     # write to Firestore
 */

const admin = require('firebase-admin');

const COLLECTION = 'faq_articles';
const isDryRun = !process.argv.includes('--apply');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  console.log(`Mode: ${isDryRun ? 'DRY-RUN (no writes)' : 'APPLY (will write to Firestore)'}`);
  console.log(`Collection: ${COLLECTION}`);
  console.log('---');

  const snap = await db.collection(COLLECTION).get();
  const docs = snap.docs;

  let migrated = 0;
  let skipped = 0;
  let noValidUntil = 0;
  const errors = [];

  for (const doc of docs) {
    const data = doc.data();
    const patch = {};

    if (data.riskLevel === null || data.riskLevel === undefined) {
      patch.riskLevel = 'low';
    }
    if (data.allowedIntents === null || data.allowedIntents === undefined) {
      patch.allowedIntents = [];
    }
    if ((data.version === null || data.version === undefined)
      && (data.versionSemver === null || data.versionSemver === undefined)) {
      patch.version = '1.0.0';
    }

    const needsMigration = Object.keys(patch).length > 0;
    const missingValidUntil = data.validUntil === null || data.validUntil === undefined;

    if (missingValidUntil) {
      noValidUntil += 1;
      console.warn(`[WARN] doc ${doc.id} has no validUntil — manual review required`);
    }

    if (!needsMigration) {
      skipped += 1;
      continue;
    }

    console.log(`[${isDryRun ? 'DRY-RUN' : 'MIGRATE'}] ${doc.id} — patch: ${JSON.stringify(patch)}`);

    if (!isDryRun) {
      try {
        await db.collection(COLLECTION).doc(doc.id).set(
          Object.assign({}, patch, { updatedAt: new Date().toISOString() }),
          { merge: true }
        );
        migrated += 1;
      } catch (err) {
        errors.push({ id: doc.id, error: err.message });
        console.error(`[ERROR] ${doc.id}: ${err.message}`);
      }
    } else {
      migrated += 1;
    }
  }

  console.log('---');
  console.log(`Total docs: ${docs.length}`);
  console.log(`To migrate: ${migrated}${isDryRun ? ' (dry-run, not written)' : ''}`);
  console.log(`Already complete: ${skipped}`);
  console.log(`Missing validUntil (manual review needed): ${noValidUntil}`);
  if (errors.length > 0) {
    console.error(`Errors: ${errors.length}`);
    process.exit(1);
  }
  if (isDryRun && migrated > 0) {
    console.log('Re-run with --apply to write changes.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
