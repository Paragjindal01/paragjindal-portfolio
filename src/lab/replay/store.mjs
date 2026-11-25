import { appendIncident, approvedHandoff, MAX_RECORDINGS, newIncident, validReplayId } from './incident.mjs';

let opening;
const STORE = 'recordings';

function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('infrapilot-incident-replay', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      resolve(db);
    };
  }).catch((error) => { opening = undefined; throw error; });
  return opening;
}

async function read(method, ...args) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE)[method](...args);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function write(lookup, update) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const request = lookup(store);
    let result;
    let failure;
    request.onsuccess = () => {
      try { result = update(store, request.result); }
      catch (error) { failure = error; transaction.abort(); }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The recording transaction was interrupted.'));
  });
}

const date = () => new Date().toISOString();

export function beginRecording(snapshot) {
  const incident = newIncident(crypto.randomUUID(), snapshot, date());
  return write((store) => store.count(), (store, count) => {
    if (count >= MAX_RECORDINGS) throw new Error('Recording library is full. Export and delete a saved recording.');
    store.add(incident);
    return incident;
  });
}

export async function getRecording(id) {
  return validReplayId(id) ? await read('get', id) : undefined;
}

export async function listRecordings() {
  return (await read('getAll')).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function recordEvent(id, snapshot, event, link) {
  const recordedAt = date();
  return write((store) => store.get(id), (store, trace) => {
    if (!trace || (link && !approvedHandoff(trace, link.handoffId, event.payload.outletId))) {
      throw new Error('The approved handoff could not be linked to this incident.');
    }
    const next = appendIncident(trace, snapshot, event, recordedAt);
    if (next !== trace) store.put(next);
    return next;
  });
}

export function deleteRecording(id) {
  return write((store) => store.get(id), (store, trace) => {
    if (!trace || trace.events.at(-1).type !== 'recording.stopped') throw new Error('Stop this recording before deleting it.');
    store.delete(id);
  });
}
