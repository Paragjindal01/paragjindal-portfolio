import { useMemo, useRef, useState } from 'react';
import {
  answerFromSources,
  buildIndex,
  compareRetrievalSettings,
  DOCUMENT_CHAR_LIMIT,
  DOCUMENT_LIMIT,
  evaluateRetrieval,
  normalizeDocument,
  SAMPLE_DOCUMENTS,
  SAMPLE_QUESTIONS,
  searchIndex,
} from './localmind.mjs';
import { AiProvider } from './LabAiProvider.jsx';
import { requestAi } from './lab-ai-client.mjs';
import { downloadReport } from './monitoring.mjs';
import './lab-ai.css';

const INITIAL_QUESTION = SAMPLE_QUESTIONS[0].query;

function readPlainText(source, name) {
  if (/\.html?$/i.test(name)) {
    const template = document.createElement('template');
    template.innerHTML = source;
    template.content.querySelectorAll('script, style, template, noscript, iframe').forEach((element) => element.remove());
    template.content.querySelectorAll('p, li, br, h1, h2, h3, h4, div, section, article').forEach((element) => element.append('\n'));
    return template.content.textContent.trim();
  }
  return source;
}

function DocumentForm({ documents, setDocuments, resetExamples }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const upload = useRef();

  function clearForm() {
    setTitle('');
    setBody('');
    setEditing('');
    setError('');
    if (upload.current) upload.current.value = '';
  }

  async function extract(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    try {
      if (!/\.(md|txt|html?)$/i.test(file.name) || file.size > 400_000) {
        throw new Error('Choose a TXT, Markdown, or HTML file under 400 KB.');
      }
      const text = readPlainText(await file.text(), file.name);
      if (!text || text.length > DOCUMENT_CHAR_LIMIT) {
        throw new Error('The extracted text must contain 1–100,000 characters.');
      }
      setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 120));
      setBody(text);
      setEditing('');
      setNotice('Text extracted. Review it and select Index document.');
    } catch (failure) {
      setError(failure.message);
    }
  }

  function save(event) {
    event.preventDefault();
    setNotice('');
    try {
      if (!editing && documents.length >= DOCUMENT_LIMIT) throw new Error('Remove a document before adding another.');
      const document = normalizeDocument({ id: editing || crypto.randomUUID(), title, text: body });
      setDocuments(editing ? documents.map((prior) => prior.id === editing ? document : prior) : [...documents, document]);
      clearForm();
      setNotice('Document indexed.');
    } catch (failure) {
      setError(failure.message);
    }
  }

  function edit(document) {
    setNotice('');
    setError('');
    setEditing(document.id);
    setTitle(document.title);
    setBody(document.text);
  }

  function remove(document) {
    if (editing === document.id) clearForm();
    setDocuments(documents.filter(({ id }) => id !== document.id));
    setNotice('Removed ' + document.title + '.');
  }

  return (
    <section className="lab-panel" aria-labelledby="localmind-library">
      <h2 id="localmind-library">Document library</h2>
      <div className="lab-table-wrap">
        <table className="lab-table">
          <thead><tr><th>Document</th><th>Words</th><th>Actions</th></tr></thead>
          <tbody>{documents.map((document) => (
            <tr key={document.id}>
              <td>{document.title}</td>
              <td>{document.text.split(/\s+/).length}</td>
              <td><div className="lab-controls">
                <button type="button" onClick={() => edit(document)} aria-label={'Edit ' + document.title}>Edit</button>
                <button type="button" onClick={() => remove(document)} aria-label={'Remove ' + document.title}>Remove</button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {documents.length === 0 && <p>The library is empty.</p>}
      <form className="lab-ai-form" onSubmit={save}>
        <h3>{editing ? 'Edit document' : 'Add a document'}</h3>
        <label>Extract text from a file <input ref={upload} type="file" accept=".txt,.md,.html,.htm" onChange={extract} /></label>
        <label>Document title <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
        <label>Document text <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={DOCUMENT_CHAR_LIMIT} rows={4} required placeholder="Paste fictional runbook text or extract it from a file." /></label>
        <div className="lab-controls">
          <button type="submit">{editing ? 'Save and reindex' : 'Index document'}</button>
          {editing && <button type="button" onClick={clearForm}>Cancel edit</button>}
          <button type="button" onClick={() => { clearForm(); resetExamples(); setNotice('Sample documents restored.'); }}>Restore sample documents</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </form>
    </section>
  );
}

function ChunkComparison({ documents, cases, index, settings }) {
  const [size, setSize] = useState('120');
  const [overlap, setOverlap] = useState('20');
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const report = comparison?.index === index && comparison?.cases === cases ? comparison.report : null;

  function compare(event) {
    event.preventDefault();
    setError('');
    try {
      const result = compareRetrievalSettings(documents, cases, index, settings, { size: Number(size), overlap: Number(overlap) });
      setComparison({ index, cases, report: result });
    } catch (failure) {
      setComparison(null);
      setError(failure.message);
    }
  }

  return <details className="lab-ai-output">
    <summary>Compare chunk settings</summary>
    <p>Run the same {cases.length} labeled {cases.length === 1 ? 'query' : 'queries'} against the active index and a candidate index. The active index stays in use.</p>
    <form className="lab-ai-form" onSubmit={compare}>
      <label>Candidate words per chunk <input type="number" min={30} max={300} value={size} onChange={(event) => setSize(event.target.value)} required /></label>
      <label>Candidate overlap words <input type="number" min={0} max={75} value={overlap} onChange={(event) => setOverlap(event.target.value)} required /></label>
      <button type="submit" disabled={!index}>Run index comparison</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {report && <div aria-live="polite">
      <div className="lab-table-wrap">
        <table className="lab-table">
          <thead><tr><th>Index</th><th>Size / overlap</th><th>Chunks</th><th>Recall@3</th><th>Mean reciprocal rank</th></tr></thead>
          <tbody>{[['Active', report.baseline], ['Candidate', report.candidate]].map(([label, summary]) => (
            <tr key={label}><th scope="row">{label}</th><td>{summary.settings.size} / {summary.settings.overlap}</td>
              <td>{summary.chunkCount}</td><td>{(summary.recall * 100).toFixed(1)}%</td><td>{summary.meanReciprocalRank.toFixed(3)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div className="lab-table-wrap">
        <table className="lab-table">
          <thead><tr><th>Evaluation query</th><th>Active rank</th><th>Candidate rank</th><th>Outcome</th></tr></thead>
          <tbody>{report.cases.map((item, position) => (
            <tr key={position}><td>{item.query}</td><td>{item.baselineRank || 'Outside first three'}</td>
              <td>{item.candidateRank || 'Outside first three'}</td><td>{item.outcome}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <button type="button" onClick={() => downloadReport('localmind-retrieval-comparison.json', JSON.stringify(report, null, 2), 'application/json')}>Export comparison</button>
    </div>}
  </details>;
}

function RetrievalEvaluation({ index, documents, settings }) {
  const [query, setQuery] = useState('');
  const [expected, setExpected] = useState('');
  const [cases, setCases] = useState(null);
  const selected = documents.find(({ id }) => id === expected)?.id || documents[0]?.id || '';
  const evaluation = index && cases ? evaluateRetrieval(index, cases) : null;
  const percentage = (fraction) => (100 * fraction).toFixed(1) + '%';
  return (
    <section className="lab-panel" aria-labelledby="localmind-evaluation">
      <h2 id="localmind-evaluation">Retrieval evaluation</h2>
      <p>Recall@3 measures whether the expected document appears in the first three chunks. Mean reciprocal rank rewards an earlier match.</p>
      <form className="lab-ai-form" onSubmit={(event) => { event.preventDefault(); setCases([{ query: query.trim(), documentId: selected }]); }}>
        <label>Evaluation query <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} placeholder="Enter what the reader would search for" required /></label>
        <label>Expected document <select value={selected} onChange={(event) => setExpected(event.target.value)} disabled={!selected}>
          {documents.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
        </select></label>
        <div className="lab-controls">
          <button type="submit" disabled={!index || !selected || !query.trim()}>Evaluate query</button>
          <button type="button" disabled={!index} onClick={() => setCases(SAMPLE_QUESTIONS)}>Run sample evaluation</button>
        </div>
      </form>
      {evaluation && <>
        <div className="lab-grid lab-ai-metrics" aria-live="polite">
          <div className="lab-stat"><span>Recall@3</span><strong>{percentage(evaluation.recall)}</strong></div>
          <div className="lab-stat"><span>Mean reciprocal rank</span><strong>{evaluation.meanReciprocalRank.toFixed(3)}</strong></div>
        </div>
        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead><tr><th>Query</th><th>Expected source</th><th>Rank</th></tr></thead>
            <tbody>{evaluation.results.map(({ query: testQuery, documentId, rank }) => (
              <tr key={testQuery}><td>{testQuery}</td><td>{documents.find(({ id }) => id === documentId)?.title || 'Source removed'}</td><td>{rank || 'Outside first three'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </>}
      <ChunkComparison documents={documents} cases={cases ?? SAMPLE_QUESTIONS} index={index} settings={settings} />
    </section>
  );
}

export default function LocalMind() {
  const [documents, setDocuments] = useState(SAMPLE_DOCUMENTS);
  const [chunkSize, setChunkSize] = useState('70');
  const [overlap, setOverlap] = useState('12');
  const [settings, setSettings] = useState({ size: 70, overlap: 12 });
  const [settingsError, setSettingsError] = useState('');
  const [query, setQuery] = useState(INITIAL_QUESTION);
  const [submitted, setSubmitted] = useState(INITIAL_QUESTION);
  const [mode, setMode] = useState('answer');
  const [provider, setProvider] = useState('offline');
  const [generation, setGeneration] = useState(null);
  const [generationError, setGenerationError] = useState('');
  const [pending, setPending] = useState(false);

  const { index, error } = useMemo(() => {
    try {
      return { index: buildIndex(documents, settings.size, settings.overlap), error: '' };
    } catch (failure) {
      return { index: null, error: failure.message };
    }
  }, [documents, settings]);

  const result = index ? searchIndex(index, submitted) : [];
  const answer = mode === 'answer' ? answerFromSources(submitted, result) : [];
  const modelAnswer = generation?.query === submitted && generation?.index === index && generation.answer.provider === provider ? generation.answer : null;

  async function ask(event) {
    event.preventDefault();
    const question = query.trim();
    if (!question || !index || pending) return;
    setSubmitted(question);
    setGeneration(null);
    setGenerationError('');
    const sources = searchIndex(index, question);
    if (mode !== 'answer' || provider === 'offline' || sources.length === 0) return;
    setPending(true);
    try {
      const response = await requestAi('localmind', {
        provider,
        question,
        sources: sources.map(({ id, title, text }) => ({ id, title, text })),
      });
      if (!response.citations?.length || !response.citations.every((id) => sources.some((source) => source.id === id))) {
        throw new Error('The generated answer did not return valid source IDs.');
      }
      setGeneration({ query: question, index, answer: response });
    } catch (failure) {
      setGenerationError(failure.message + ' Showing the offline answer.');
    } finally {
      setPending(false);
    }
  }

  function updateSettings(event) {
    event.preventDefault();
    try {
      const nextSettings = { size: Number(chunkSize), overlap: Number(overlap) };
      buildIndex(documents, nextSettings.size, nextSettings.overlap);
      setSettings(nextSettings);
      setSettingsError('');
    } catch (failure) {
      setSettingsError(failure.message);
    }
  }

  function citation(id) {
    const index = result.findIndex(({ id: sourceId }) => sourceId === id) + 1;
    const targetId = 'localmind-source-' + index;
    return <a key={id} href={'#' + targetId} aria-label={'Open source ' + index} onClick={(event) => {
      event.preventDefault();
      const item = document.getElementById(targetId);
      const details = item?.querySelector('details');
      if (details) details.open = true;
      item?.scrollIntoView({ block: 'nearest' });
      details?.querySelector('summary')?.focus({ preventScroll: true });
    }}>[{index}]</a>;
  }

  return (
    <div className="lab-ai-stack">
      <section className="lab-panel" aria-labelledby="localmind-query">
        <h2 id="localmind-query">Query the knowledge base</h2>
        <p>{documents.length} documents · {index?.chunks.length || 0} indexed chunks · Session-only storage</p>
        <form className="lab-ai-form" onSubmit={ask}>
          <label>Question or search phrase <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} required /></label>
          <div className="lab-controls">
            <label>Mode <select value={mode} onChange={(event) => { setMode(event.target.value); setGeneration(null); }}>
              <option value="answer">Question answering</option>
              <option value="search">Semantic search</option>
            </select></label>
            {mode === 'answer' && <AiProvider value={provider} onChange={(next) => { setProvider(next); setGeneration(null); }} />}
            <button type="submit" disabled={!index || pending}>{pending ? 'Generating…' : mode === 'answer' ? 'Ask LocalMind' : 'Find passages'}</button>
          </div>
        </form>
        {error && <p role="alert">{error}</p>}
        {generationError && <p role="status">{generationError}</p>}
        {submitted && <div className="lab-ai-output" aria-live="polite">
          <h3>{mode === 'answer' ? 'Answer' : 'Search results'}</h3>
          <p className="lab-ai-query">{submitted}</p>
          {mode === 'answer' && (modelAnswer ? <>
            <span className="lab-badge">{modelAnswer.provider === 'ollama' ? 'Ollama-generated' : 'External model'}</span>
            <p>{modelAnswer.text} {modelAnswer.citations.map(citation)}</p>
          </> : <>
            <span className="lab-badge">Offline · Extractive answer</span>
            {answer.length ? <ul>{answer.map(({ text, sourceId }) => <li key={text}>{text}{' '}
              {citation(sourceId)}
            </li>)}</ul> : <p>No grounded answer available. Try a different question or add a relevant document.</p>}
          </>)}
          <h3>Ranked sources</h3>
          {result.length ? <ol className="lab-ai-sources">
            {result.map(({ id, title, text, number, score, startWord, endWord }, index) => (
              <li key={id} id={'localmind-source-' + (index + 1)}>
                <details>
                  <summary><strong>{title}</strong> · Chunk {number} · Similarity {score.toFixed(3)}</summary>
                  <p>Words {startWord}–{endWord}</p>
                  <blockquote>{text}</blockquote>
                </details>
              </li>
            ))}
          </ol> : <p>No chunks met the relevance threshold.</p>}
        </div>}
      </section>

      <div className="lab-grid lab-ai-columns">
        <DocumentForm documents={documents} setDocuments={(next) => { buildIndex(next, settings.size, settings.overlap); setDocuments(next); }} resetExamples={() => setDocuments(SAMPLE_DOCUMENTS)} />
        <div className="lab-ai-stack">
          <section className="lab-panel" aria-labelledby="localmind-index">
            <h2 id="localmind-index">Index settings</h2>
            <form className="lab-ai-form" onSubmit={updateSettings}>
              <label>Words per chunk <input type="number" min={30} max={300} value={chunkSize} onChange={(event) => setChunkSize(event.target.value)} required /></label>
              <label>Overlap words <input type="number" min={0} max={75} value={overlap} onChange={(event) => setOverlap(event.target.value)} required /></label>
              <button type="submit">Rebuild index</button>
            </form>
            {settingsError && <p role="alert">{settingsError}</p>}
            <p aria-live="polite">Active settings: {settings.size} words per chunk, {settings.overlap} words of overlap.</p>
          </section>
          <RetrievalEvaluation index={index} documents={documents} settings={settings} />
        </div>
      </div>
    </div>
  );
}
