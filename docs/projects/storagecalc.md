# StorageCalc

StorageCalc compares uniform-node replicated and erasure-coded storage designs. Its interactive inputs cover disk geometry, replication, erasure coding, reservations, operating headroom, failed nodes, and expansion. The chart and JSON export show theoretical capacity separately from planning capacity.

## Run

From the portfolio root, run `npm ci` and `npm run dev`, then open the engineering lab and select StorageCalc. Run the domain tests with `node --test src/lab/apps/storage.test.mjs`.

![StorageCalc running in the engineering lab](../../public/lab-screenshots/storagecalc.webp)

## Architecture

```mermaid
flowchart LR
  Inputs[Cluster form] --> Model[Validated capacity model]
  Model --> Placement[Host failure-domain check]
  Placement --> Charts[Capacity charts and scenarios]
  Placement --> Report[JSON report]
```

The React UI calls a deterministic JavaScript module. The initial sample contains eight fictional nodes with twelve 18 TB drives per node. Decimal TB uses 10¹² bytes and TiB uses 2⁴⁰ bytes.

Raw capacity multiplies node count, drives per node, and drive capacity. Replicated capacity divides by the replica count. Erasure-coded capacity multiplies by k/(k+m). Planning capacity applies the reserve percentage, then applies operating headroom to the remaining capacity. The model requires a distinct host for every replica or erasure shard. [Ceph erasure coding documentation](https://docs.ceph.com/en/tentacle/rados/operations/erasure-code/)

## Security and limits

The planner works in the browser with synthetic inputs. Reports are generated locally. It assumes uniform drives, balanced distribution, and one shard per host failure domain. Actual recoverability depends on placement, pool settings, recovery space, and cluster health. The model does not estimate placement-group imbalance, metadata overhead, recovery time, or workload performance.

**Status** Functional browser MVP.
