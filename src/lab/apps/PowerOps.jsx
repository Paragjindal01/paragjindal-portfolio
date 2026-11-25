import { useEffect, useRef, useState } from 'react';
import { createPowerAdapter, historicalEnergy, loadStatus, phaseBalance } from './powerops.mjs';
import { decimal, downloadReport, percent, scenarioWindow, toCsv } from './monitoring.mjs';
import { approvedHandoff, validReplayId } from '../replay/incident.mjs';
import { getRecording, recordEvent } from '../replay/store.mjs';
import './monitoring.css';

const actionNames = { on: 'Turn on', off: 'Turn off', reboot: 'Reboot' };
const phases = ['A', 'B', 'C'];

function initialHandoff() {
  const params = new URLSearchParams(window.location.search);
  const incident = params.get('incident');
  const handoff = params.get('handoff');
  return { outletId: params.get('outlet') ?? '', incident: validReplayId(incident) && validReplayId(handoff) ? incident : '', handoff };
}

function PowerConfirmation({ request, confirm, cancel }) {
  const modal = useRef(null);
  useEffect(() => {
    const dialog = modal.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={modal} className="ops-dialog" aria-labelledby="power-confirm-title" onCancel={(event) => {
    event.preventDefault();
    cancel();
  }}>
    <h2 id="power-confirm-title">Confirm simulated action</h2>
    <p>{actionNames[request.action]} outlet <strong>{request.outletId}</strong> in this browser session.</p>
    <div className="lab-controls">
      <button type="button" autoFocus onClick={cancel}>Cancel</button>
      <button type="button" onClick={confirm}>Confirm {request.action}</button>
    </div>
  </dialog>;
}

function LoadIndicator({ watts, ratedW, threshold }) {
  const status = loadStatus(watts, ratedW, threshold);
  const tone = status === 'Overload' ? 'critical' : status === 'Warning' ? 'warning' : 'online';
  return <span className="lab-badge" data-status={tone}>{status} · {decimal(percent(watts, ratedW), 1)}%</span>;
}

export default function PowerOps({ snapshot, scenario }) {
  const [adapter] = useState(createPowerAdapter);
  const [handoff] = useState(initialHandoff);
  const [powerSessionId] = useState(() => crypto.randomUUID());
  const initialOutletId = handoff.outletId;
  const [isLinked, setLinked] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [pduId, setPduId] = useState(() => snapshot.pdus.find((pdu) => pdu.outlets.some((outlet) => outlet.id === initialOutletId))?.id ?? snapshot.pdus[0]?.id);
  const [outletId, setOutletId] = useState(initialOutletId);
  const [role, setRole] = useState('viewer');
  const [threshold, setThreshold] = useState(80);
  const [request, setRequest] = useState(null);
  const [message, setMessage] = useState('');
  const [showBalance, setShowBalance] = useState(false);
  const [, setVersion] = useState(0);
  const linkedReboot = useRef(null);
  const pdus = adapter.inspect(snapshot);
  const pdu = pdus.find((item) => item.id === pduId) ?? pdus[0];
  const outlet = pdu.outlets.find((item) => item.id === outletId) ?? pdu.outlets[0];
  const rebootPending = pdus.some((item) => item.outlets.some((entry) => entry.state === 'rebooting'));
  const deviceNames = new Map([...snapshot.servers, ...snapshot.switches].map((device) => [device.id, device.name]));
  const rack = snapshot.racks.find((item) => item.id === pdu.rackId);
  const rackPower = pdus.filter((item) => item.rackId === rack.id).reduce((sum, item) => sum + item.powerW, 0);
  const energySamples = scenarioWindow(snapshot);
  const rackEnergy = historicalEnergy(energySamples, rack.id);
  const balance = showBalance ? phaseBalance(pdu.outlets) : null;
  const audit = adapter.history().reverse();

  useEffect(() => {
    if (!handoff.incident) return;
    getRecording(handoff.incident).then((trace) => {
      if (trace && trace.events.at(-1).type !== 'recording.stopped' && approvedHandoff(trace, handoff.handoff, handoff.outletId)) setLinked(true);
      else setLinkError('The local incident recording is missing, closed, or unrelated to this outlet.');
    }).catch(() => setLinkError('Local incident recording is unavailable.'));
  }, [handoff]);

  function capturePower(type, payload) {
    if (!handoff.incident || handoff.outletId !== payload.outletId) return;
    void recordEvent(handoff.incident, snapshot, { type, source: 'powerops', payload: { ...payload, handoffId: handoff.handoff, powerSessionId } }, { handoffId: handoff.handoff })
      .catch((error) => setLinkError(error.message));
  }

  useEffect(() => {
    const recordedReboot = linkedReboot.current;
    if (!recordedReboot || rebootPending) return;
    const recovered = adapter.inspect(snapshot).flatMap((device) => device.outlets).find((item) => item.id === recordedReboot.outletId);
    if (recovered?.state !== 'on') return;
    linkedReboot.current = null;
    void recordEvent(handoff.incident, snapshot, { type: 'power.recovered', source: 'powerops', payload: {
      outletId: recordedReboot.outletId, requestId: recordedReboot.id, handoffId: handoff.handoff, powerSessionId, observation: recovered,
    } }, { handoffId: handoff.handoff }).catch((error) => setLinkError(error.message));
  }, [adapter, snapshot, handoff, powerSessionId, rebootPending]);

  useEffect(() => {
    if (!rebootPending) return undefined;
    const interval = window.setInterval(() => setVersion((value) => value + 1), 250);
    return () => window.clearInterval(interval);
  }, [rebootPending]);

  function selectPdu(id) {
    setPduId(id);
    setOutletId('');
    setShowBalance(false);
  }

  function prepare(action) {
    setMessage('');
    try {
      const next = adapter.prepare(snapshot, { role, outletId: outlet.id, action });
      setRequest(next);
      capturePower('power.prepared', { ...next, role, before: outlet });
    } catch (error) {
      setMessage(error.message);
      capturePower('power.denied', { outletId: outlet.id, action, role, reason: error.message });
    }
  }

  function cancel() {
    adapter.cancel(request.id);
    capturePower('power.cancelled', { ...request, role });
    setRequest(null);
  }

  function confirm() {
    try {
      const before = adapter.inspect(snapshot).flatMap((device) => device.outlets).find((item) => item.id === request.outletId);
      const entry = adapter.confirm(snapshot, { role, id: request.id });
      const after = adapter.inspect(snapshot).flatMap((device) => device.outlets).find((item) => item.id === request.outletId);
      capturePower('power.confirmed', { ...entry, before, after });
      if (handoff.incident && handoff.outletId === entry.outletId && entry.action === 'reboot') linkedReboot.current = entry;
      setMessage(actionNames[entry.action] + ' recorded for ' + entry.outletId + '.');
    } catch (error) {
      setMessage(error.message);
      capturePower('power.denied', { ...request, role, reason: error.message });
    } finally {
      setRequest(null);
    }
  }

  function exportReport() {
    const header = ['Scenario', 'Rack', 'PDU', 'PDU rated W', 'PDU load W', 'PDU load kW', 'PDU modeled energy kWh', 'Outlet', 'Device', 'Phase', 'Rated W', 'Load W', 'Load %', 'State', 'Alert threshold %'];
    const entries = pdus.flatMap((item) => {
      const energy = historicalEnergy(energySamples, item.id);
      return item.outlets.map((entry) => [scenario, item.rackId, item.id, item.ratedW, item.powerW, decimal(item.powerW / 1000, 3),
        decimal(energy, 3), entry.id, entry.deviceId ?? entry.serverId, entry.phase, entry.ratedW, entry.powerW,
        decimal(percent(entry.powerW, entry.ratedW), 2), entry.state, threshold]);
    });
    downloadReport('powerops-' + scenario + '.csv', toCsv([header, ...entries]), 'text/csv;charset=utf-8');
  }

  const replayParams = new URLSearchParams({ incident: handoff.incident, scenario });
  if (snapshot.step) replayParams.set('step', String(snapshot.step));
  return <div className="ops-stack">
    {isLinked && <section className="lab-panel" aria-label="Linked incident recording">
      <strong>Incident recording linked</strong><p>Actions on this handoff’s outlet are added to the local incident timeline.</p>
      <a href={'/lab/infrapilot-ai?' + replayParams + '#incident-replay'}>Return to incident replay</a>
    </section>}
    {linkError && <p role="alert">{linkError}</p>}
    <div className="lab-grid ops-stats" aria-label="Rack power summary">
      <div className="lab-stat"><span>Rack draw · {rack.name}</span><strong>{decimal(rackPower / 1000, 2)} kW</strong></div>
      <div className="lab-stat"><span>Rack rated capacity</span><strong>{decimal(rack.capacityW / 1000, 2)} kW</strong></div>
      <div className="lab-stat"><span>Modeled energy · 6 h</span><strong>{decimal(rackEnergy, 2)} kWh</strong></div>
      <div className="lab-stat"><span>Rack utilization</span><strong>{decimal(percent(rackPower, rack.capacityW), 1)}%</strong></div>
    </div>
    <section className="lab-panel">
      <h2>PDU inventory</h2>
      <div className="lab-controls">
        <label>Power distribution unit<select value={pdu.id} onChange={(event) => selectPdu(event.target.value)}>
          {pdus.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.rackId}</option>)}
        </select></label>
        <label>Demo role<select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="viewer">Viewer</option><option value="operator">Operator</option>
        </select></label>
        <form className="lab-controls" onSubmit={(event) => {
          event.preventDefault();
          setThreshold(Number(new FormData(event.currentTarget).get('threshold')));
        }}>
          <label>Warning threshold (%)
            <input type="number" name="threshold" min="1" max="99" required defaultValue={threshold} />
          </label>
          <button type="submit">Apply threshold</button>
        </form>
        <button type="button" onClick={exportReport}>Export power CSV</button>
      </div>
      <div className="ops-overflow" tabIndex="0" role="region" aria-label="PDU inventory table">
        <table className="lab-table ops-table">
          <thead><tr>{['PDU', 'Rack', 'Draw', 'Rated capacity', 'Utilization'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{pdus.map((item) => <tr key={item.id}>
            <th scope="row"><button type="button" aria-pressed={item.id === pdu.id} onClick={() => selectPdu(item.id)}>{item.name}</button></th>
            <td>{item.rackId}</td><td>{decimal(item.powerW)} W</td><td>{decimal(item.ratedW)} W</td>
            <td><LoadIndicator watts={item.powerW} ratedW={item.ratedW} threshold={threshold} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <div className="ops-columns">
      <section className="lab-panel">
        <h2>Outlet map</h2>
        <p>{pdu.name} · {decimal(pdu.powerW)} W · {pdu.outlets.length} outlets</p>
        <div className="ops-outlets" aria-label="Select an outlet">
          {pdu.outlets.map((entry) => <button key={entry.id} type="button" aria-pressed={outlet?.id === entry.id} onClick={() => setOutletId(entry.id)}>
            <strong aria-label={'Outlet ' + entry.number}>{String(entry.number).padStart(2, '0')}</strong>
            <span>Phase {entry.phase}</span>
            <span data-status={entry.state === 'on' ? 'online' : 'warning'}>{entry.state}</span>
          </button>)}
        </div>
        {outlet && <>
          <dl className="ops-details">
            <div><dt>Outlet</dt><dd>{outlet.id}</dd></div>
            <div><dt>Mapped device</dt><dd>{deviceNames.get(outlet.deviceId ?? outlet.serverId) ?? 'Unassigned'}</dd></div>
            <div><dt>Power / capacity</dt><dd>{decimal(outlet.powerW)} / {outlet.ratedW} W</dd></div>
            <div><dt>Load</dt><dd><LoadIndicator watts={outlet.powerW} ratedW={outlet.ratedW} threshold={threshold} /></dd></div>
          </dl>
          <div className="lab-controls" aria-label="Simulated outlet controls">
            {Object.entries(actionNames).map(([action, label]) => <button key={action} type="button"
              disabled={role !== 'operator' || outlet.state === 'rebooting' || outlet.state === action || (action === 'reboot' && outlet.state !== 'on')}
              onClick={() => prepare(action)}>{label}</button>)}
          </div>
          {role === 'viewer' && <p>Select the Operator demo role to request a simulated control action.</p>}
          {message && <p role="status">{message}</p>}
        </>}
      </section>
      <section className="lab-panel">
        <h2>Phase balancing</h2>
        <p>Compare measured synthetic phase loads with a proposed reassignment.</p>
        <dl className="ops-details">
          {phases.map((phase) => <div key={phase}><dt>Phase {phase}</dt>
            <dd>{decimal(pdu.phaseWatts[phase])} W{balance && ' → ' + decimal(balance.phaseWatts[phase]) + ' W'}</dd></div>)}
        </dl>
        <button type="button" aria-expanded={showBalance} onClick={() => setShowBalance((value) => !value)}>
          {showBalance ? 'Hide proposed balance' : 'Simulate phase balancing'}
        </button>
        {balance && <ul className="ops-list">
          {balance.assignments.every((entry) => entry.from === entry.to) && <li>Current phases already match the simulated plan.</li>}
          {balance.assignments.filter((entry) => entry.from !== entry.to).map((entry) => (
            <li key={entry.outletId}>Outlet {entry.number} · {entry.from} → {entry.to} · {decimal(entry.powerW)} W</li>
          ))}
        </ul>}
      </section>
    </div>
    <section className="lab-panel">
      <h2>Audit history</h2>
      <p>Confirmed actions are recorded for this simulated session.</p>
      {audit.length > 0 && <div className="ops-overflow" tabIndex="0" role="region" aria-label="Audit history table">
        <table className="lab-table ops-table">
          <thead><tr>{['Time (UTC)', 'Outlet', 'Action', 'Role'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{audit.map((entry) => <tr key={entry.id}>
            <td>{entry.timestamp}</td><td>{entry.outletId}</td><td>{actionNames[entry.action]}</td><td>{entry.role}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    {request && <PowerConfirmation request={request} confirm={confirm} cancel={cancel} />}
  </div>;
}
