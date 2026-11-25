import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot } from '../simulator.mjs';
import { appendIncident, approvedHandoff, MAX_EVENTS, newIncident, parseIncident, summarize } from './incident.mjs';

const id = '7c77b9fe-2f24-44b7-aee8-835aa301f216';
const requestId = '4a2d4edb-2229-4723-9e8a-0e2709bb48cc';
const time = '2026-11-25T15:00:00.000Z';
const normal = createSnapshot();
const fault = createSnapshot({ scenario: 'critical', step: 4 });

function append(trace, snapshot, type, payload) {
  return appendIncident(trace, snapshot, { type, payload }, time);
}

test('interleaves transitions, full checkpoints, and recommendation results in one stable timeline', () => {
  let trace = newIncident(id, normal, time);
  assert.equal(append(trace, normal, 'telemetry.captured'), trace);
  const result = { recommendations: ['Review the cooling path.'], summary: 'Elevated temperature.' };
  trace = append(trace, fault, 'analysis.completed', { result });
  assert.deepEqual(trace.events.map((e) => e.type), ['recording.started', 'telemetry.captured', 'scenario.changed', 'telemetry.captured', 'analysis.completed']);
  assert.deepEqual(trace.events[3].payload, fault);
  assert.equal(summarize(trace, 3).telemetry.scenario, 'normal');
  assert.deepEqual(summarize(trace, 5).analysis.result.recommendations, result.recommendations);
  assert.deepEqual(parseIncident(JSON.stringify(trace)), trace);
});

test('retains scenario context across telemetry ticks, marks reviewed requests and prevents appending after stop', () => {
  let trace = newIncident(id, fault, time);
  const request = { id: requestId, outletId: 'SIM-P2-O01', operation: 'off' };
  trace = append(trace, fault, 'handoff.approved', { request, role: 'operator' });
  assert.equal(approvedHandoff(trace, requestId, 'SIM-P2-O01'), true);
  assert.equal(approvedHandoff(trace, requestId, 'SIM-P2-O02'), false);
  const next = createSnapshot({ scenario: 'critical', step: 5 });
  trace = append(trace, next, 'telemetry.captured');
  trace = append(trace, next, 'recording.stopped');
  assert.equal(summarize(trace).decision.type, 'handoff.approved');
  assert.equal(summarize(trace).closed, true);
  assert.throws(() => append(trace, next, 'analysis.rejected'), /closed/);
});

test('validates archive format, context, event order and the final slot for stopping', () => {
  const trace = append(newIncident(id, normal, time), fault, 'telemetry.captured');
  assert.throws(() => parseIncident('not JSON'), /valid JSON/);
  assert.throws(() => parseIncident(JSON.stringify({ ...trace, version: 4 })), /unsupported/i);
  const gap = structuredClone(trace);
  gap.events[1].sequence = 9;
  assert.throws(() => parseIncident(JSON.stringify(gap)), /invalid event/);
  const missing = structuredClone(trace);
  missing.events.pop();
  assert.throws(() => parseIncident(JSON.stringify(missing)), /missing its checkpoint/);
  const malformed = structuredClone(trace);
  malformed.events[1].payload.pdus[0] = null;
  assert.throws(() => parseIncident(JSON.stringify(malformed)), /synthetic telemetry/);
  let limited = newIncident(id, normal, time);
  for (let i = limited.events.length; i < MAX_EVENTS - 1; i++) limited = append(limited, normal, 'schedule.changed', { seconds: 15 });
  assert.throws(() => append(limited, normal, 'schedule.changed', { seconds: 60 }), /Recording limit/);
  assert.equal(append(limited, normal, 'recording.stopped').events.length, MAX_EVENTS);
});
