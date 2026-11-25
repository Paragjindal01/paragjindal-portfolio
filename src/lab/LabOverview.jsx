import { useState } from 'react';
import { Kinetic } from '../higgsfield/home/chrome.tsx';
import { LAB_TOOLS, toolHref } from './lab-design.mjs';
import '../higgsfield/lab/lab-index.css';

const categoryCounts = new Map();
for (const { category } of LAB_TOOLS) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

export default function LabOverview({ scenario }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [preview, setPreview] = useState(null);
  const term = query.trim().toLowerCase();
  const shown = LAB_TOOLS.filter((tool) => (
    (category === null || tool.category === category) &&
    [tool.name, tool.caption, tool.description, tool.category, tool.area].some((value) => value.toLowerCase().includes(term))
  ));

  function filterBy(name) {
    setCategory((current) => current === name ? null : name);
    setPreview(null);
  }

  function showPreview(event, tool) {
    setPreview({ tool, top: event.currentTarget.offsetTop });
  }

  return <>
    <div className="labtools">
      <label className="labtools__search">
        <span className="labtools__label">Search</span>
        <input type="search" placeholder="Name, category or capability" value={query} onChange={(event) => { setQuery(event.target.value); setPreview(null); }} />
      </label>
      <div className="labtools__cats" role="group" aria-label="Filter by category">
        <button className="labtools__cat" data-on={category === null ? 'true' : undefined} aria-pressed={category === null} type="button" onClick={() => filterBy(null)}>All <span>{LAB_TOOLS.length}</span></button>
        {Array.from(categoryCounts, ([name, count]) => <button className="labtools__cat" data-on={category === name ? 'true' : undefined} aria-pressed={category === name} key={name} type="button" onClick={() => filterBy(name)}>{name} <span>{count}</span></button>)}
      </div>
      <p className="labtools__count" role="status">{shown.length} of {LAB_TOOLS.length} systems{category ? ` · ${category}` : ''}</p>
    </div>

    <div className="index" onMouseLeave={() => setPreview(null)}>
      {shown.map((tool) => <a className="index__row" key={tool.id} href={toolHref(tool, scenario)} onFocus={(event) => showPreview(event, tool)} onBlur={() => setPreview(null)} onMouseEnter={(event) => showPreview(event, tool)}>
        <span aria-hidden="true" className="index__num">{tool.number}</span>
        <span className="index__name">{tool.name}</span>
        <span className="index__desc">{tool.caption}</span>
        <span className="index__cat">{tool.category}</span>
        <span aria-hidden="true" className="index__arrow">↗</span>
      </a>)}
      {shown.length === 0 && <div className="labtools__empty"><p>No system matches “{query || category}”.</p><button className="cta-text" type="button" onClick={() => { setQuery(''); setCategory(null); }}>Clear filters</button></div>}
      <div aria-hidden="true" className="index__preview" data-on={preview ? 'true' : 'false'} style={{ top: preview?.top ?? 0 }}>{preview && <img alt="" decoding="async" loading="lazy" src={preview.tool.art} />}</div>
    </div>

    <div className="index__foot">
      <p>Fictional infrastructure · synthetic telemetry · simulated controls</p>
      <a className="cta-text" href="/case-studies">Engineering case studies <span aria-hidden="true">↗</span></a>
    </div>
    <div className="lab-index-outro"><Kinetic text="Ten systems, one fictional facility." /></div>
  </>;
}
