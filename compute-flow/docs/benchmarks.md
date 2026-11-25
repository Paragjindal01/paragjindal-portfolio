# Reproducible policy benchmarks

Run `npm run benchmark` to reproduce these outcomes. Run `npm run benchmark -- --json` for the complete metrics. Each comparison holds the cluster, jobs, memory requests, priorities, deadlines, and faults constant. All four policies use best-fit placement. The table reports simulated outcomes with rounded display values.

| Scenario | Seed | Jobs | GPU cap | Fault |
| --- | ---: | ---: | ---: | --- |
| Atlas mixed arrivals | 42 | 36 | 2,900 W | None |
| Meridian device outage | 165 | 64 | 4,350 W | First GPU offline at minute 18 for 12 minutes |
| Foundry lower power budget | 123 | 52 | 900 W | None |

| Scenario | Policy | Completed | P95 wait (min) | On time | GPU use | Jobs/hour | Fragmentation | kWh | Fairness |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Atlas | FIFO | 36 | 71.64 | 50.0% | 67.8% | 15.20 | 17.1% | 5.695 | 0.991 |
| Atlas | Priority | 36 | 90.08 | 61.1% | 66.9% | 15.02 | 18.8% | 5.708 | 0.968 |
| Atlas | Fair share | 36 | 109.05 | 41.7% | 58.4% | 12.91 | 18.6% | 5.879 | 0.976 |
| Atlas | FIFO + backfill | 36 | 60.37 | 72.2% | 75.8% | 17.04 | 70.1% | 5.582 | 0.996 |
| Meridian | FIFO | 64 | 129.67 | 25.0% | 76.2% | 15.09 | 3.1% | 14.608 | 0.956 |
| Meridian | Priority | 64 | 138.67 | 65.6% | 73.4% | 14.57 | 11.2% | 14.701 | 0.929 |
| Meridian | Fair share | 64 | 140.39 | 46.9% | 81.5% | 15.81 | 4.1% | 14.507 | 0.998 |
| Meridian | FIFO + backfill | 64 | 109.24 | 43.8% | 88.9% | 17.65 | 43.3% | 14.228 | 0.947 |
| Foundry | FIFO | 39 | 473.38 | 1.9% | 18.1% | 3.78 | 81.7% | 7.462 | 0.983 |
| Foundry | Priority | 39 | 534.02 | 3.8% | 16.9% | 3.55 | 75.1% | 7.751 | 0.956 |
| Foundry | Fair share | 39 | 479.91 | 1.9% | 18.1% | 3.80 | 88.5% | 7.449 | 0.998 |
| Foundry | FIFO + backfill | 39 | 437.06 | 1.9% | 19.3% | 4.05 | 96.7% | 7.172 | 0.984 |

On Atlas, backfill lowered p95 queue wait by 11.27 simulated minutes versus FIFO and finished more jobs by their deadlines. On Meridian, priority met the most deadlines, backfill completed the most jobs per simulated hour, and fair share had the highest fairness index. Foundry's power and placement limits rendered 13 jobs infeasible under every policy. A queue rule can only reorder feasible work.

Fragmentation is conditional on idle time while the queue has demand. A higher value can accompany higher utilization when the scheduler uses the feasible idle capacity and leaves a smaller pool of idle GPUs unable to run the waiting jobs. [Metric definitions](architecture.md#metrics)
