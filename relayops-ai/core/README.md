# RelayOps workflow core

The same workflow definitions and deterministic operations run in the browser and in the local SQLite-backed service. The browser execution adapter uses bundled sources and session-local state. Connected execution is opt-in on the local service.

| Flagship template | Input | Result |
| --- | --- | --- |
| GitHub Engineering Review | `repositoryUrl` | Bounded repository evidence and prioritized findings tied to the source revision |
| Autonomous Research Pipeline | `question` | Parallel planning and sample-source loading, followed by a cited brief and source verification |
| Data Intelligence Analyst | `format` and `dataset` | Validated flat CSV or JSON, descriptive statistics, IQR outlier flags, chart series, and a Markdown report |
| Infrastructure Incident Investigator | A synthetic incident ID and 1–200 telemetry samples | Threshold events, evidence-backed hypotheses, a report, and approval-gated synthetic mitigation |

The offline GitHub review only accepts the bundled fictional repository URL. In connected mode, the connector accepts public GitHub HTTPS repository URLs and sends unauthenticated GETs to the fixed GitHub REST host. It pins citations to a single commit, samples up to three eligible text files, and never follows user-supplied links in repository content. [GitHub repository contents](https://docs.github.com/en/rest/repos/contents)

Research uses a small, labeled source collection about traces, incident management, and postmortems. Matching uses keywords. Claim verification checks every statement against that collection and reports insufficient evidence when the question is outside its coverage. [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/) · [Google SRE incident management](https://sre.google/sre-book/managing-incidents/) · [Google SRE postmortems](https://sre.google/sre-book/postmortem-culture/)

Dataset calculations use a population standard deviation, linearly interpolated quartiles, and 1.5× IQR fences. Alerts require at least four numeric observations. Incident correlations suggest explanations and reference the timestamps and measurements that support them. Approvals authorize a projection recorded in the execution log, with no network or hardware action.

The Transform node’s `parse-document` operation accepts local TXT or Markdown in the `document` field. It extracts headings, bounded excerpts, and word/line counts without reading filesystem paths.

The integration allowlist also includes a predefined USGS public feed in connected mode and a labeled fictional response in offline mode. The operation accepts no URL from workflow data. Notifications write simulated delivery records. [USGS GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)

## Model adapters

The four templates are deterministic. To exercise a configured model, add an Agent node with the `model` operation and run it in connected mode. The server loads provider credentials and model selections from its environment. Configure OpenAI, Anthropic, Gemini, Ollama, or a compatible loopback endpoint using [the environment template](../.env.example).

The model receives a bounded JSON evidence envelope and returns a validated summary. It cannot invoke tools. Set `RELAYOPS_PROVIDER_ORDER` for automatic order, `RELAYOPS_PROVIDER_FALLBACK=0` to disable fallback, and `RELAYOPS_PROVIDER_MAX_OUTPUT_TOKENS` to cap each call. Fallback is limited to three candidates and stops on provider throttling. Exact reported token usage is recorded when supplied. Configure both per-million token prices for cloud cost estimates and pre-request cost budgets. Usage from upstream work interrupted before a response cannot be measured locally. [OpenAI](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) · [Anthropic](https://platform.claude.com/docs/en/api/messages) · [Gemini](https://ai.google.dev/api/generate-content) · [Ollama](https://docs.ollama.com/api/chat)

## Evaluation

Evaluation scores recorded executions against applicable completion, output shape, tool selection, reference, approval, retry recovery, and artifact checks. It reports elapsed time, tokens, and estimated cost from recorded metrics. Comparing two versions uses their actual execution records. An absent provider metric is shown as unavailable.

Run `node --test core/*.test.mjs` to reproduce tests against all four workflows, mocked provider requests, network policy, and the analysis and evaluation rules. Live model providers require local configuration and were not called for these tests.
