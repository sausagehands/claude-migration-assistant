// tests/unit/categorize-by-age.test.js
// The recent/archive split must compare instants, not date strings.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeByAge } from '../../js/processing/conversation-parser.js';

const DAY = 86400000;
const daysAgo = (days, offsetMs = 0) => new Date(Date.now() - days * DAY + offsetMs).toISOString();
const conv = (id, fields) => ({ uuid: id, ...fields });

test('splits on the 90-day cutoff', () => {
  const { recent, archive } = categorizeByAge([
    conv('new', { updated_at: daysAgo(10) }),
    conv('old', { updated_at: daysAgo(200) })
  ]);
  assert.deepEqual(recent.map(c => c.uuid), ['new']);
  assert.deepEqual(archive.map(c => c.uuid), ['old']);
});

test('respects a timezone offset near the cutoff', () => {
  // 1 hour inside the window, written with a +02:00 offset and as Z.
  const instant = new Date(Date.now() - 90 * DAY + 5 * 3600000);
  const withOffset = new Date(instant.getTime() + 2 * 3600000).toISOString().replace('Z', '+02:00');
  const asZ = instant.toISOString();
  const { recent } = categorizeByAge([conv('offset', { updated_at: withOffset }), conv('zulu', { updated_at: asZ })]);
  assert.deepEqual(recent.map(c => c.uuid).sort(), ['offset', 'zulu']);
});

test('a +02:00 stamp just outside the window is archived even though its string sorts later', () => {
  // Instant is 1h outside the window; local clock string reads 2h later than UTC.
  const instant = new Date(Date.now() - 90 * DAY - 5 * 3600000);
  const stamp = new Date(instant.getTime() + 2 * 3600000).toISOString().replace('Z', '+02:00');
  const { archive } = categorizeByAge([conv('late', { updated_at: stamp })]);
  assert.deepEqual(archive.map(c => c.uuid), ['late']);
});

test('files an unparseable date as recent', () => {
  const { recent, archive } = categorizeByAge([conv('bad', { updated_at: 'not a date' })]);
  assert.equal(recent.length, 1);
  assert.equal(archive.length, 0);
});

test('falls back to created_at when updated_at is empty', () => {
  const { recent, archive } = categorizeByAge([
    conv('old', { updated_at: '', created_at: daysAgo(300) }),
    conv('new', { updated_at: '', created_at: daysAgo(5) })
  ]);
  assert.deepEqual(archive.map(c => c.uuid), ['old']);
  assert.deepEqual(recent.map(c => c.uuid), ['new']);
});
