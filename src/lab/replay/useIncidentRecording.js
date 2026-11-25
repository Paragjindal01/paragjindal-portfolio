import { useCallback, useEffect, useRef, useState } from 'react';
import { beginRecording, getRecording, listRecordings, recordEvent } from './store.mjs';

function updateUrl(incidentId) {
  const url = new URL(window.location.href);
  if (incidentId) url.searchParams.set('incident', incidentId);
  else url.searchParams.delete('incident');
  window.history.replaceState(null, '', url);
}

export function useIncidentRecording(snapshot) {
  const [id, setId] = useState('');
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const queue = useRef(Promise.resolve());
  const refresh = useCallback(async () => {
    try { setLibrary(await listRecordings()); }
    catch (failure) { setError(failure.message || 'Browser recording storage is unavailable.'); }
  }, []);

  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get('incident');
    if (linked) getRecording(linked).then((trace) => {
      if (trace && trace.events.at(-1).type !== 'recording.stopped') setId(linked);
    }).catch((failure) => setError(failure.message));
    void Promise.resolve().then(refresh);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const capture = useCallback((type, payload = {}) => {
    if (!id) return Promise.resolve(null);
    const append = queue.current.then(() => recordEvent(id, snapshot, { type, payload })).then((trace) => {
      setLibrary((prior) => prior.map((item) => item.id === id ? trace : item));
      return trace;
    }).catch((failure) => { setError(failure.message); return null; });
    queue.current = append;
    return append;
  }, [id, snapshot]);

  useEffect(() => {
    void capture('telemetry.captured');
  }, [capture]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const trace = await beginRecording(snapshot);
      updateUrl(trace.id);
      setLibrary((prior) => [trace, ...prior]);
      setId(trace.id);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function stop() {
    setBusy(true);
    if (await capture('recording.stopped')) {
      updateUrl('');
      setId('');
    }
    setBusy(false);
  }

  function resume(trace) {
    if (!id && trace.events.at(-1).type !== 'recording.stopped') {
      updateUrl(trace.id);
      setError('');
      setId(trace.id);
    }
  }

  return { id, library, error, busy, start, stop, resume, refresh, capture };
}
