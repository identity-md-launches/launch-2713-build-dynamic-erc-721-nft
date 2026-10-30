import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatus, moodFor, progressText, rpmText } from '../src/lib/status.ts';

const now = Date.parse('2026-10-30T12:00:00Z');
const fixture = (measurement = {}, builder = {}) => ({ schemaVersion: 1, revision: 'test-fixture', measurement: { freshness: 'online', observedAt: new Date(now - 5000).toISOString(), receivedAt: new Date(now - 4000).toISOString(), staleAfterSeconds: 120, coreStatus: 'IDLE', rpmMilli: 0, provenance: 'hardware', ...measurement }, builder: { status: 'available', anchor: { blockHeight: '4135', blockProgress: '35822082' }, ...builder } });

test('maps real API units and settled progress without floating point loss', () => {
  const status = parseStatus(fixture({ rpmMilli: 77_005, coreStatus: 'ACTIVE' }), now);
  assert.equal(status.rpmMilli, 77_005);
  assert.equal(rpmText(status.rpmMilli), '77');
  assert.equal(status.blockHeight, 4135n);
  assert.equal(progressText(status.blockProgress), '3.6%');
  assert.equal(moodFor(status), 'energetic');
});
test('uses explicit IDLE state over residual RPM and honors the 60 rpm boundary', () => {
  assert.equal(moodFor(parseStatus(fixture({ rpmMilli: 90_000 }), now)), 'resting');
  assert.equal(moodFor(parseStatus(fixture({ rpmMilli: 59_999, coreStatus: 'ACTIVE' }), now)), 'active');
  assert.equal(moodFor(parseStatus(fixture({ rpmMilli: 60_000, coreStatus: 'ACTIVE' }), now)), 'energetic');
});
test('stale, future and fault readings never become sleeping', () => {
  for (const measurement of [{ freshness: 'stale' }, { receivedAt: '2026-10-30T11:57:00Z' }, { observedAt: '2026-10-30T11:57:00Z' }, { coreStatus: 'COUNTER_FAULT' }, { observedAt: '2026-10-30T12:02:00Z' }]) {
    assert.equal(moodFor(parseStatus(fixture(measurement), now)), 'unknown');
  }
});
test('unavailable builder is unknown progress, not zero', () => {
  const status = parseStatus(fixture({}, { status: 'unavailable' }), now);
  assert.equal(status.blockHeight, null); assert.equal(status.blockProgress, null);
  assert.equal(parseStatus(fixture({}, { anchor: { blockHeight: '9007199254740993', blockProgress: '1000000000' } }), now).blockProgress, null);
  assert.equal(parseStatus(fixture({}, { anchor: { blockHeight: '9007199254740993', blockProgress: '0' } }), now).blockHeight, 9007199254740993n);
});
test('rejects incompatible, incomplete and malformed measurements', () => {
  for (const value of [null, {}, { ...fixture(), schemaVersion: 2 }, fixture({ rpmMilli: -1 }), fixture({ rpmMilli: '0' }), fixture({ observedAt: 'invalid' }), fixture({ staleAfterSeconds: 0 }), fixture({ coreStatus: 'other' })]) assert.throws(() => parseStatus(value, now));
});
