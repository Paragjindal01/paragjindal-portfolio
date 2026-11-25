# Simulator API

The engineering applications use a shared version 2 runtime contract. The browser imports the engine directly so the operational demos can run without a backend. External tooling can read the same contract from the local Vite server, Docker container, or Vercel deployment.

```sh
curl 'http://localhost:5173/api/simulation?scenario=critical&step=0'
```

`GET /api/simulation` accepts optional `scenario` and `step` parameters. The default is `normal` and `0`. Choose `normal`, `warning`, `critical`, or `recovery`, with steps from 0 to 1,000,000. Identical inputs give identical output. Each step advances 15 synthetic minutes. Invalid inputs return JSON with status 400. Other methods return status 405 where dispatched to this handler.

| Field | Content |
| --- | --- |
| `snapshot.schemaVersion` | `2` |
| `snapshot.mode` | `simulation` |
| `snapshot.facilities`, `rooms`, `racks` | Hierarchy, normalized room coordinates, rack units, temperature in °C, humidity as %, and rated watts |
| `snapshot.servers`, `switches` | Mounted equipment, CPU and network utilization, server and GPU health, storage in TB, and RAM/VRAM in GiB |
| `snapshot.pdus` | Rated watts, phase totals, and outlet records with stable IDs and device mappings |
| `snapshot.workloads` | Fictional VMs and containers linked to hosts |
| `snapshot.alerts`, `health` | Metric-specific rule output and a summary of server count and total power |

The four example scenarios model nominal operation, rising temperature and demand, a thermal and availability incident, and recovery. The ambient warning begins at 29 °C and becomes critical at 35 °C. GPU alerts begin at 80 °C and become critical at 90 °C. PDU warnings start at 80% of simulated rated power. These are demonstration rules. GPUWatch and PowerOps expose independent thresholds for their views.

The simulator uses addresses from the IPv4 documentation space. No credentials, employer data, live infrastructure, or network calls enter the snapshot. Outlet mutation exercises are confined to the separate PowerOps browser state and never mutate the API snapshot.
