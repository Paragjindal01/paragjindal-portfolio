# Security policy

RelayOps is an independent engineering release with a public, browser-only demonstration. Report suspected security defects privately to the maintainer through [GitHub](https://github.com/Paragjindal01) or the [portfolio contact form](https://paragjindal.com/#contact). Include the affected version and a concise reproduction using synthetic data. Keep secrets, customer information, and real infrastructure logs out of the report.

## Trust boundaries

- Offline workflows receive no model credentials and make no network requests to integration targets.
- The local SQLite service uses unguessable, hashed session capability tokens and owner-scoped records. Session capabilities belong to the browser profile that created them. This is a local-user authorization design, with no identity federation or multi-tenant service admission.
- Graph types and connector IDs are allowlisted. Connectors construct bounded read-only requests to named public APIs. User-supplied GitHub repository URLs are parsed as identifiers. The service does not fetch arbitrary paths, private origins or redirects, or run user scripts.
- Connected mode is explicit and requires a loopback bind. Provider API keys stay in the server environment. Model answers are schema-checked summaries and receive no execution or approval capability. Evidence and repository text remain untrusted data.
- Webhook registrations pin an owner and one saved workflow version. Signed JSON deliveries can queue offline runs only. The secret stays in the local service and is returned once to its registrant. Rotate a secret by revoking and recreating the registration.
- Approvals require an explicit decision for a waiting step. Approval and event history is separate from workflow output. Demo notifications and mitigation actions are simulated.
- The static demo uses local browser storage. The backend persists workflow inputs and outputs in SQLite. Both are intended for synthetic or authorized data. Restrict access to the local volume and export files.

See [API and limits](docs/api.md) for request contracts and [contributing](CONTRIBUTING.md) for local verification.
