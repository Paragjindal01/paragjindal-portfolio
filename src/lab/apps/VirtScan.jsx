import { useState } from 'react';
import { compareInventory, filterInventory, inventoryFromSnapshot, inventoryTypes } from './virtscan.mjs';
import { downloadReport, toCsv } from './monitoring.mjs';
import './monitoring.css';

const typeLabels = { host: 'Host', vm: 'VM', container: 'Container' };

export default function VirtScan({ snapshot }) {
  const [inventory, setInventory] = useState(() => inventoryFromSnapshot(snapshot));
  const [changes, setChanges] = useState(null);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [assetId, setAssetId] = useState('');
  const visible = filterInventory(inventory.assets, { query, type, status });
  const selected = visible.find((asset) => asset.id === assetId) ?? visible[0];
  const statuses = [...new Set(inventory.assets.map((asset) => asset.status))];
  const counts = Object.fromEntries(inventoryTypes.map((item) => [item, inventory.assets.filter((asset) => asset.type === item).length]));

  function sync() {
    const updated = inventoryFromSnapshot(snapshot);
    setChanges(compareInventory(inventory, updated));
    setInventory(updated);
    if (!updated.assets.some((asset) => asset.status === status)) setStatus('');
  }

  function exportJson() {
    downloadReport('virtscan-' + inventory.scenario + '.json', JSON.stringify({ ...inventory, assets: visible }, null, 2), 'application/json');
  }

  function exportCsv() {
    const header = ['Snapshot UTC', 'Scenario', 'ID', 'Name', 'Type', 'Location', 'OS', 'Status', 'CPU cores', 'RAM GiB', 'Storage GiB', 'Interfaces', 'IPs', 'MACs'];
    const rows = visible.map((asset) => [
      inventory.timestamp, inventory.scenario, asset.id, asset.name, asset.type, asset.location, asset.os,
      asset.status, asset.cpuCores, asset.memoryGiB, asset.storageGiB, asset.interfaces.map((item) => item.name).join(' / '),
      asset.interfaces.map((item) => item.ip).join(' / '), asset.interfaces.map((item) => item.mac).join(' / '),
    ]);
    downloadReport('virtscan-' + inventory.scenario + '.csv', toCsv([header, ...rows]), 'text/csv;charset=utf-8');
  }

  return <div className="ops-stack">
    <div className="lab-grid ops-stats" aria-label="Inventory totals">
      <div className="lab-stat"><span>Discovered hosts</span><strong>{counts.host}</strong></div>
      <div className="lab-stat"><span>Virtual machines</span><strong>{counts.vm}</strong></div>
      <div className="lab-stat"><span>Containers</span><strong>{counts.container}</strong></div>
      <div className="lab-stat"><span>Last synchronization</span><strong>{inventory.scenario}</strong></div>
    </div>
    <section className="lab-panel">
      <h2>Inventory synchronization</h2>
      <p>Snapshot <time dateTime={inventory.timestamp}>{inventory.timestamp}</time> · {inventory.scenario} scenario</p>
      <div className="lab-controls">
        <button type="button" onClick={sync}>Synchronize inventory</button>
        <button type="button" onClick={exportJson}>Export JSON</button>
        <button type="button" onClick={exportCsv}>Export CSV</button>
        <label>Search assets<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, host, OS, IP or MAC" /></label>
        <label>Asset type<select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">All assets</option>
          {inventoryTypes.map((item) => <option key={item} value={item}>{typeLabels[item]}</option>)}
        </select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select></label>
      </div>
      {changes && <p role="status">{changes.length ? changes.length + ' changes detected in the latest synchronization.' : 'Inventory synchronized. No changes detected.'}</p>}
    </section>
    <div className="ops-columns ops-inventory">
      <section className="lab-panel">
        <h2>Asset inventory</h2>
        <p>{visible.length} assets match the current filters.</p>
        {visible.length > 0 && <div className="ops-overflow" tabIndex="0" role="region" aria-label="Asset inventory table">
          <table className="lab-table ops-table">
            <thead><tr>{['Asset', 'Type', 'Rack / host', 'CPU', 'RAM', 'Status'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{visible.map((asset) => <tr key={asset.id}>
              <th scope="row"><button type="button" aria-pressed={asset.id === selected.id} onClick={() => setAssetId(asset.id)}>{asset.name}</button></th>
              <td>{typeLabels[asset.type]}</td><td>{asset.location}</td><td>{asset.cpuCores} cores</td><td>{asset.memoryGiB} GiB</td>
              <td><span className="lab-badge" data-status={asset.status}>{asset.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div>}
      </section>
      {selected && <section className="lab-panel">
        <h2>{selected.name}</h2>
        <dl className="ops-details">
          <div><dt>Asset ID</dt><dd>{selected.id}</dd></div>
          <div><dt>Operating system</dt><dd>{selected.os}</dd></div>
          <div><dt>CPU</dt><dd>{selected.cpuCores} cores</dd></div>
          <div><dt>RAM</dt><dd>{selected.memoryGiB} GiB</dd></div>
          <div><dt>Storage</dt><dd>{selected.storageGiB.toLocaleString('en-CA')} GiB</dd></div>
          <div><dt>Status</dt><dd>{selected.status}</dd></div>
        </dl>
        <h3>Network interfaces</h3>
        <ul className="ops-list">{selected.interfaces.map((network) => <li key={network.name}>
          <strong>{network.name}</strong>{network.speedGbps ? ' · ' + network.speedGbps + ' Gbps' : ''}
          <small>{network.ip} · {network.mac}</small>
        </li>)}</ul>
      </section>}
    </div>
    {changes?.length > 0 && <section className="lab-panel">
      <h2>Snapshot changes</h2>
      <div className="ops-overflow" tabIndex="0" role="region" aria-label="Snapshot changes table">
        <table className="lab-table ops-table">
          <thead><tr>{['Asset', 'Change', 'Details'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{changes.map((change) => <tr key={change.id}>
            <th scope="row">{change.name}</th><td>{change.type}</td><td>{change.detail}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
  </div>;
}
