import { useState } from 'react'
import { calculateStorage, DEFAULT_PLAN, PLAN_FIELDS } from './storage.mjs'
import './visual-tools.css'

const quantity = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 })
const format = value => value === null ? 'Unavailable' : quantity.format(value)
const planNumber = value => value === '' ? Number.NaN : Number(value)

function CapacityChart({ results }) {
  const maximum = Math.max(...results.map(result => result.current.rawTB), 1)
  return <figure className="lab-panel storage-comparison">
    <figcaption><h3>Current capacity comparison</h3></figcaption>
    {results.map(result => (
      <div key={result.label}>
        <strong>{result.label}</strong>
        {[
          ['Raw', result.current.rawTB, 'raw'],
          ['Theoretical', result.current.theoreticalTB, 'theoretical'],
          ['Planning target', result.current.planningTB, 'planning'],
        ].map(([label, amount, tone]) => (
          <div className="storage-bar-row" key={label}>
            <span>{label}</span>
            <div className="storage-bar-track" aria-hidden="true">
              <span className={`storage-bar storage-bar-${tone}`} style={{ width: `${(amount ?? 0) / maximum * 100}%` }} />
            </div>
            <strong>{format(amount)}{amount !== null && ' TB'}</strong>
          </div>
        ))}
      </div>
    ))}
  </figure>
}

function download(plan, results) {
  const report = {
    model: 'Uniform storage nodes with one distinct host per shard',
    assumptions: [
      'Decimal TB equals 10^12 bytes. Binary TiB equals 2^40 bytes.',
      'Reservation applies before operating headroom.',
      'Planning targets are capacity estimates. Operational availability, durability and recovery require independent verification.',
    ],
    plan,
    results,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'storagecalc-capacity-report.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function StorageCalc() {
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const values = Object.fromEntries(Object.entries(plan).map(([key, value]) => [key, planNumber(value)]))
  let results
  let error
  try {
    results = calculateStorage(values)
  } catch (exception) {
    error = exception.message
  }

  return <div className="visual-tool">
    <section className="lab-panel">
      <h3>Cluster configuration</h3>
      <div className="visual-form-grid">
        {PLAN_FIELDS.map(([key, label, min, max, step]) => (
          <label key={key}>{label}
            <input type="number" inputMode={step === 1 ? 'numeric' : 'decimal'}
              min={min} max={max} step={step} value={plan[key]}
              onChange={event => setPlan({ ...plan, [key]: event.target.value })} />
          </label>
        ))}
      </div>
      <div className="visual-actions">
        <button type="button" onClick={() => results && download(values, results)} disabled={!results}>Export calculation report</button>
        <button type="button" onClick={() => setPlan(DEFAULT_PLAN)}>Reset sample plan</button>
      </div>
      {error && <p className="visual-error" role="alert">{error}</p>}
    </section>
    {results && <>
      <CapacityChart results={results} />
      <section className="lab-panel">
        <h3>Failure domains and expansion</h3>
        <p>Each host is a distinct failure domain. Drive count and capacity are uniform. The planning target subtracts capacity reservation, then applies operating headroom.</p>
        <div className="visual-table-wrap">
          <table className="lab-table">
            <thead>
              <tr><th scope="col">Protection</th><th scope="col">Scenario</th><th scope="col">Host domains</th><th scope="col">Raw TB / TiB</th><th scope="col">Theoretical TB / TiB</th><th scope="col">Planning TB / TiB</th></tr>
            </thead>
            <tbody>
              {results.flatMap(result => [
                ['Current', result.current],
                ['After failure', result.failed],
                ['After expansion', result.expanded],
              ].map(([stage, capacity]) => (
                <tr key={`${result.label} ${stage}`}>
                  <th scope="row">{result.label}</th><td>{stage}</td>
                  <td><strong>{capacity.domains} / {capacity.requiredDomains}</strong><br />
                    {capacity.placementPossible ? 'Placement feasible' : 'Insufficient domains'}</td>
                  <td>{format(capacity.rawTB)} / {format(capacity.rawTiB)}</td>
                  <td>{format(capacity.theoreticalTB)} / {format(capacity.theoreticalTiB)}</td>
                  <td>{capacity.planningTB === null ? 'Unavailable' : `${format(capacity.planningTB)} / ${format(capacity.planningTiB)}`}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        {results.map(result => (
          <p key={result.label}>
            <strong>{result.label}.</strong> {result.withinModelLossBudget ? 'Within' : 'Outside'} the modeled shard-loss allowance of {result.modelLossBudget}.
            {result.expansionDeltaTB !== null && ` Expansion adds ${format(result.expansionDeltaTB)} TB of planning capacity.`}
          </p>
        ))}
        <p>Operational availability depends on actual placement, minimum I/O thresholds, cluster health and sufficient free space during recovery. This model estimates capacity under each layout.</p>
      </section>
    </>}
  </div>
}
