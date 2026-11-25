import { MAX_STEP, SCENARIOS } from '../simulator.mjs';

export const FORMAT = 'infrapilot.incident-replay';
export const VERSION = 1;
export const MAX_EVENTS = 200;
export const MAX_REPLAY_BYTES = 6 * 1024 * 1024;
export const MAX_RECORDINGS = 20;

const kinds = {
  'recording.started': 'Recording started',
  'recording.stopped': 'Recording stopped',
  'scenario.changed': 'Scenario transition',
  'telemetry.captured': 'Telemetry checkpoint',
  'analysis.completed': 'Analysis and recommendations',
  'analysis.rejected': 'Query or workflow rejected',
  'thresholds.changed': 'Thresholds changed',
  'schedule.changed': 'Report schedule changed',
  'handoff.prepared': 'Handoff prepared',
  'handoff.approved': 'Handoff approved',
  'handoff.rejected': 'Handoff rejected',
  'handoff.denied': 'Handoff decision denied',
  'power.prepared': 'PowerOps confirmation prepared',
  'power.cancelled': 'PowerOps confirmation cancelled',
  'power.confirmed': 'PowerOps simulated action confirmed',
  'power.denied': 'PowerOps action denied',
  'power.recovered': 'Outlet reboot completed',
};

export const eventLabel = (kind) => kinds[kind];
export const validReplayId = (id) => typeof id === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id);
const listFields = ['facilities', 'rooms', 'racks', 'servers', 'switches', 'pdus', 'workloads', 'alerts'];
const byteLength = (value) => new TextEncoder().encode(value).byteLength;
const instant = (time) => typeof time === 'string' && Number.isFinite(Date.parse(time)) && new Date(time).toISOString() === time;
const scenarioStep = (sample) => !!sample && SCENARIOS.includes(sample.scenario) && Number.isSafeInteger(sample.step) && sample.step >= 0 && sample.step <= MAX_STEP;
const sameFrame = (left, right) => left?.scenario === right?.scenario && left?.step === right?.step;

function assertTelemetry(snapshot) {
  if (!scenarioStep(snapshot) || snapshot.mode !== 'simulation' || snapshot.schemaVersion !== 2 || !instant(snapshot.timestamp) ||
    !listFields.every((name) => Array.isArray(snapshot[name])) ||
    !snapshot.pdus.every((item) => item && Number.isFinite(item.powerW) && item.powerW >= 0)) {
    throw new Error('A version 2 synthetic telemetry snapshot is required.');
  }
}

function recorded(type, source, payload, context, recordedAt, sequence) {
  if (!Object.hasOwn(kinds, type) || !instant(recordedAt) || !['infrapilot', 'powerops'].includes(source)) throw new Error('Invalid incident event.');
  return { type, source, recordedAt, sequence, scenario: context.scenario, step: context.step, payload };
}

function withEvents(trace, additions) {
  const events = [...trace.events, ...additions];
  const value = { ...trace, events };
  const closing = events.at(-1).type === 'recording.stopped';
  if (events.length > MAX_EVENTS - (closing ? 0 : 1) || byteLength(JSON.stringify(value)) > MAX_REPLAY_BYTES - (closing ? 0 : 2048)) {
    throw new Error('Recording limit reached. Stop and export this recording before starting another.');
  }
  return value;
}

export function newIncident(id, snapshot, recordedAt) {
  assertTelemetry(snapshot);
  if (!validReplayId(id)) throw new Error('Invalid incident ID.');
  return withEvents({ format: FORMAT, version: VERSION, id, startedAt: recordedAt, events: [] }, [
    recorded('recording.started', 'infrapilot', {}, snapshot, recordedAt, 1),
    recorded('telemetry.captured', 'infrapilot', snapshot, snapshot, recordedAt, 2),
  ]);
}

export function appendIncident(trace, snapshot, { type, source = 'infrapilot', payload = {} }, recordedAt) {
  assertTelemetry(snapshot);
  if (!trace || trace.events.at(-1).type === 'recording.stopped') throw new Error('This incident recording is closed or unavailable.');
  const current = trace.events.findLast((event) => event.type === 'telemetry.captured');
  if (type === 'recording.started' || type === 'scenario.changed' || type === 'telemetry.captured' && sameFrame(current, snapshot)) return trace;
  const additions = [];
  const add = (kind, data, context = snapshot) => additions.push(recorded(kind, source, data, context, recordedAt, trace.events.length + additions.length + 1));
  if (type === 'recording.stopped') {
    add(type, {}, current);
    return withEvents(trace, additions);
  }
  if (!sameFrame(current, snapshot)) {
    if (current.scenario !== snapshot.scenario) add('scenario.changed', { from: current.scenario, to: snapshot.scenario, fromStep: current.step });
    add('telemetry.captured', snapshot);
  }
  if (type !== 'telemetry.captured') add(type, payload);
  return withEvents(trace, additions);
}

function verifyEvent(event, i, telemetry, prior, isFinal) {
  if (!event || !Object.hasOwn(kinds, event.type) || event.sequence !== i + 1 || !instant(event.recordedAt) ||
    !scenarioStep(event) || !['infrapilot', 'powerops'].includes(event.source) || !event.payload ||
    typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new Error('The recording contains an invalid event.');
  if (event.type === 'recording.started' && i !== 0 || event.type === 'recording.stopped' && !isFinal) throw new Error('The recording boundaries are invalid.');
  if (event.type === 'telemetry.captured') {
    assertTelemetry(event.payload);
    if (!sameFrame(event, event.payload) || (telemetry && telemetry.scenario !== event.scenario && prior.type !== 'scenario.changed')) throw new Error('The telemetry checkpoint is inconsistent.');
    return event;
  }
  if (event.type === 'scenario.changed') {
    if (!telemetry || event.payload.from !== telemetry.scenario || event.payload.fromStep !== telemetry.step ||
      event.payload.to !== event.scenario || event.scenario === telemetry.scenario) throw new Error('The recording contains an inconsistent scenario transition.');
  } else if (telemetry && !sameFrame(telemetry, event)) throw new Error('An event refers to a missing telemetry checkpoint.');
  if (event.type === 'analysis.completed' && (!Array.isArray(event.payload.result?.recommendations) ||
    !event.payload.result.recommendations.every((item) => typeof item === 'string'))) throw new Error('Invalid recorded recommendations.');
  return telemetry;
}

function assertBoundedJson(value, depth = 0) {
  if (depth > 24) throw new Error('The incident file is nested too deeply.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('An incident file contains a non-finite reading.');
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) assertBoundedJson(child, depth + 1);
  }
}

export function parseIncident(text) {
  if (typeof text !== 'string' || byteLength(text) > MAX_REPLAY_BYTES) throw new Error('Incident files must be under 6 MiB.');
  let trace;
  try { trace = JSON.parse(text); }
  catch { throw new Error('The file does not contain valid JSON.'); }
  if (!trace || trace.format !== FORMAT || trace.version !== VERSION || !validReplayId(trace.id) || !instant(trace.startedAt) ||
    !Array.isArray(trace.events) || trace.events.length < 2 || trace.events.length > MAX_EVENTS ||
    trace.events[0]?.type !== 'recording.started' || trace.events[0].recordedAt !== trace.startedAt ||
    trace.events[1]?.type !== 'telemetry.captured' || !sameFrame(trace.events[0], trace.events[1])) throw new Error('Unsupported or incomplete incident recording.');
  assertBoundedJson(trace);
  let telemetry;
  for (const [i, event] of trace.events.entries()) {
    const next = trace.events[i + 1];
    telemetry = verifyEvent(event, i, telemetry, trace.events[i - 1], !next);
    if (event.type === 'scenario.changed' && (next?.type !== 'telemetry.captured' || !sameFrame(event, next))) throw new Error('A scenario transition is missing its checkpoint.');
  }
  return trace;
}

export function summarize(trace, sequence = trace.events.length) {
  const prefix = trace.events.slice(0, sequence);
  const latest = (type) => prefix.findLast((event) => event.type === type)?.payload ?? null;
  return {
    telemetry: latest('telemetry.captured'), analysis: latest('analysis.completed'),
    decision: prefix.findLast((event) => ['handoff.approved', 'handoff.rejected', 'handoff.denied', 'power.confirmed', 'power.cancelled', 'power.denied'].includes(event.type)) ?? null,
    closed: prefix.at(-1)?.type === 'recording.stopped',
  };
}

export function approvedHandoff(trace, handoffId, outletId) {
  return validReplayId(handoffId) && trace.events.some(({ type, payload }) =>
    type === 'handoff.approved' && payload.request?.id === handoffId && payload.request?.outletId === outletId);
}
