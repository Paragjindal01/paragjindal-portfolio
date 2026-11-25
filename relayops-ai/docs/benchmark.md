# Offline workflow benchmark

Run `npm run benchmark` against the local SQLite service. Each case submits a fixed synthetic input, checks an idempotent duplicate, observes a terminal status or approval request, and verifies the recorded trace and measured evaluation. It approves one incident and explicitly rejects another. Every case uses deterministic offline execution.

## Measured sample

One run on November 25, 2026 used Node.js 26.10.0, a fresh SQLite database, and the local HTTP service. Cases ran sequentially. These are individual local measurements, including HTTP round trips and scripted approval, with no warm-up or concurrency load.

| Template | Decision | Result | Completed steps | Recorded events | Evaluation | Elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub Engineering Review | None | Completed | 5 | 13 | 100 | 8 ms |
| Autonomous Research Pipeline | None | Completed | 6 | 15 | 100 | 13 ms |
| Data Intelligence Analyst | None | Completed | 5 | 13 | 100 | 5 ms |
| Infrastructure Incident Investigator | Approve | Completed | 7 | 21 | 100 | 6 ms |
| Infrastructure Incident Investigator | Reject | Failed as expected | 5 | 18 | 80 | 5 ms |

Each case reported zero model tokens and zero estimated model cost. Evaluation counts executed output checks, policy and reference checks, and whether the workflow completed. The rejection intentionally reduced the task completion score while validating the approval boundary. These scores describe the bundled scenarios. They do not measure general model accuracy.
