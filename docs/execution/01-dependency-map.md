# Dependency Map

This is the execution graph for the first Pulse milestone. It is ordered by
merge waves, not by product chapter. A later product concern may move earlier
when the vertical slice depends on it; run snapshots and immutability are the
important example.

## Planning gate

`P0` is complete when S0-T00 and S0-T02 are complete and the frozen [domain
contracts](06-domain-contracts.md) have been acknowledged. No S1-S4
implementation starts before P0.

## Task graph

| Task | Name | Depends on | Safe parallel peer |
| --- | --- | --- | --- |
| S0-T00 | Environment preflight | none | S0-T02 |
| S0-T04 | Conditional feature-bench repair | blocked S0-T00 outcome | S0-T02 |
| S0-T01 | Baseline verification | verified S0-T00; S0-T04 if activated | S0-T02 |
| S0-T02 | Current model inventory | none | S0-T00/S0-T01 |
| S0-T03 | Acceptance fixture specification | S0-T01, S0-T02 | none |
| S1-T00 | Domain package and test scaffold | P0 | S1-T01, S2-T01 |
| S1-T01 | Lifecycle schema and migration | P0 | S1-T00, S2-T01 |
| S1-T02 | Schedule schema and migration | S1-T01 | S1-T04, S2-T00, S2-T01 |
| S4-T01 | Run snapshot schema | S1-T02 | S1-T04, S2-T00, S2-T01 |
| S1-T03 | Scheduling policy and idempotent generation | S1-T00, S4-T01 | S1-T04, S2-T00, S2-T01 |
| S1-T04 | Compliance policy and score adapter | S1-T00, S1-T02 | S4-T01/S1-T03, S2-T00, S2-T01 |
| S1-T07 | Deadline finalization job | S1-T03, S1-T04 | S2-T00, S2-T01 |
| S1-T05 | My Work submission contract | S1-T07 | S2-T02 |
| S4-T03 | Immutable finalized runs | S1-T05, S4-T01 | S2-T02 |
| S1-T06 | Implement acceptance fixtures | S1-T05, S4-T03, S0-T03 | S2-T02 |
| S1-T08 | Template command API | S1-T02, S2-T00 | S1-T03/S1-T04 |
| S2-T05 | People and hierarchy command API | S2-T00 | S1-T08 |
| S1-T09 | Assignment command API | S1-T08, S2-T05 | none |
| S1-T10 | Template editor UI | S1-T08 | S2-T06, manager UI tasks |
| S2-T06 | Hierarchy setup UI | S2-T05 | S1-T10, manager UI tasks |
| S1-T11 | Assignment UI | S1-T09, S1-T10, S2-T06 | none |
| S2-T00 | Hierarchy scope resolver | S1-T00 | S1 tasks, S2-T01 |
| S2-T01 | Gauge orientation | P0 | backend tasks |
| S2-T02 | Personal and inherited score endpoints | S1-T04, S2-T00 | S1-T05/S4-T03/S1-T06 |
| S2-T03 | Hierarchy roll-up correctness | S2-T02 | S3-T01, S3-T02 |
| S3-T01 | Scoped failure list API | S1-T04, S2-T00 | S2-T03, S3-T02 |
| S2-T04 | Manager drill entry points | S2-T03, S3-T01 | none |
| S3-T02 | Trends and period filters | S1-T04, S2-T00 | S2-T03, S3-T01 |
| S3-T03 | Mission Control first view | S2-T04, S3-T01 | none |
| S3-T04 | Analytics filters and trend view | S3-T02, S3-T03 | none |
| S4-T02 | Event timeline design | S1-T05, S4-T01 | post-milestone design work |
| S4-T04 | Effective-dated hierarchy design | S4-T01, S2-T00 | post-milestone design work |
| S5-T01 | Snooze policy model | S1-T02, S4-T01 | S5-T02 |
| S5-T02 | Escalation target resolver | S2-T00 | S5-T01 |
| S5-T03 | Manager follow-up work | S5-T01, S5-T02 | none |
| S6-T01 | Generic evaluation template design | S4-T01 | S6-T02 after draft |
| S6-T02 | Required gate contract | S6-T01 | none |
| S6-T03 | One-step linked completion | S6-T02, S1-T05 | none |

## Merge waves

Do not merge by lane independently. Merge and verify in these waves:

| Wave | Tasks | Gate before next wave |
| --- | --- | --- |
| W0 Discover | S0-T00; S0-T04 if activated; S0-T01, S0-T02, S0-T03 | environment, baseline, and fixture spec recorded |
| W1 Foundation/schema | S1-T00 and S1-T01 -> S1-T02 -> S4-T01 | test discovery plus clean/legacy migrate pass |
| W2 Domain | S1-T03 + S1-T04 -> S1-T07; S2-T00 -> S1-T08; S2-T01 | contracts pass; generation/finalization retries are idempotent |
| W3 Execution/setup | S1-T05, S4-T03, S2-T02, S2-T05 -> S1-T09 | submission, immutability, score scopes, and command permissions pass |
| W4 Explainability | S1-T06, S2-T03, S3-T01, S3-T02 | deterministic 100/0/50/null scenario and scoped queries pass |
| W5 Product UI | S1-T10, S2-T06 -> S1-T11; S2-T04 -> S3-T03 -> S3-T04 | setup-to-submission and manager browser scenarios pass |

Each wave gets one integration owner. The integration owner merges schema work
first, runs migration, then merges domain/adapters, and only then hands the
frozen response shape to frontend work.

## Critical path for first milestone

```text
S0-T00 (+ S0-T04 repair and S0-T00 rerun when blocked)
  -> S0-T01 + S0-T02 + S0-T03 + P0
  -> S1-T00 + (S1-T01 -> S1-T02 -> S4-T01)
       |
       +-> S1-T03 + S1-T04 -> S1-T07 -> S1-T05 -> S4-T03
       |
       +-> S2-T00 -> S1-T08 + S2-T05 -> S1-T09
       |
       +-> S1-T04 + S2-T00 -> (S2-T02 -> S2-T03) + S3-T01 + S3-T02
       |
       +-> S2-T01

Backend joins
  -> S1-T06
  -> S1-T10 + S2-T06 -> S1-T11
  -> S2-T04 -> S3-T03 -> S3-T04
  -> milestone acceptance
```

`S1-T06` joins before milestone acceptance. `S2-T01` may be completed any time
after P0, but must be present before W5 verification.

## Why some apparent parallelism is forbidden

- S1-T01, S1-T02, and S4-T01 all edit `SOP Run` schema, so they are sequential.
- S1-T03 and S1-T04 can run together after their prerequisites because one owns
  scheduling/generation and the other owns compliance/scoring.
- S2-T03, S3-T01, and S3-T02 can run together only after the score and hierarchy
  interfaces are frozen; their allowed backend files are disjoint.
- S2-T04 follows S3-T01 because the drill UI must integrate the real failure-list
  response rather than invent a second contract.
- S3-T03 follows S2-T04 because both edit Operations. S3-T04 follows S3-T03
  because both frontend tasks may edit shared TypeScript types.
- S1-T10 and S1-T11 are sequential because both edit Templates. S2-T06 may run
  beside S1-T10 because it owns Team and a separate people service.

## Recommended first dispatch

Start with two read-only agents:

- Agent A: S0-T00 environment preflight, then S0-T01 baseline verification.
- Agent B: S0-T02 model inventory.

After W0, use at most four active implementation agents, one from each healthy
worker lane in the [execution pool](00-operating-model.md#execution-pool):

- schema owner on the next sequential schema task;
- package owner on S1-T00, then hierarchy owner on S2-T00;
- frontend owner on S2-T01;
- one additional owner only when a ready task has a disjoint write set.

Do not let more than one agent edit the same DocType JSON, shared TypeScript
types, or the same API module in one wave.
