# Operating Model

Use this document when assigning Pulse work to small agents.

## Work unit size

Each work unit should fit in one narrow task:

- one domain concern;
- one backend/API area or one frontend surface;
- one verification command or demo path;
- no broad refactor unless the task explicitly asks for it.

Task IDs are stable labels, not execution order. Dependencies and merge waves
are authoritative; for example S1-T07 intentionally completes before S1-T05.

A small agent should not be asked to "make Pulse compliant". It should be asked
to do a task like `S1-T02 Add schedule fields and a migration`.

## Agent rules

Every agent must:

1. read [Product plan](../PRODUCT_PLAN.md), [Domain context](../../CONTEXT.md),
   [Domain contracts](06-domain-contracts.md), and [Agent reference](../../AGENTS.md);
2. open the task card in [Task backlog](03-task-backlog.md);
3. only edit files listed in the task card unless it records a reason;
4. avoid changing public behavior outside the task acceptance checks;
5. run the smallest meaningful verification;
6. leave a short handoff note with changed files, checks run, and follow-up risk.

## Execution pool

The integration owner distributes ready, disjoint tasks across these worker
lanes as evenly as dependencies and file ownership allow:

- GPT-5.4 with medium reasoning through the Codex subagent runner;
- Kimi through the Kimi CLI;
- Gemini Flash Low through Antigravity;
- MiniMax M3 through OpenCode Go (`opencode-go/minimax-m3`).

Each run receives one task card and one bounded objective. The integration owner
reviews every diff and owns merges. A worker that is silent, looping, or no
longer advancing its task is stopped and replaced. If a lane is unavailable,
record the failure and redistribute the task. MiniMax M2.7 is disabled for the
current run after two stale attempts; Claude Haiku is the final execution
fallback after the configured worker lanes fail.

Keep every healthy lane occupied whenever the dependency graph exposes enough
ready tasks with disjoint write sets. Do not serialize independent work. A lane
may remain idle only when a dependency, overlapping file ownership, required
integration review, or bench-safety constraint blocks another safe dispatch.

## Branch and bench posture

Use the persistent `pulse-reference` bench for read-only inspection and baseline
comparison only. Development happens in host Git worktrees under the owning
track. Independent agents may use separate task worktrees and do not need a
live bench. Merge reviewed commits into the integration branch before syncing
them into any bench.

Any task that writes site data, runs a migration, starts a scheduler/worker, or
performs submission/runtime testing must use a disposable feature bench created
through `mh new`. Schema files may be authored and statically reviewed in host
worktrees first; their migration gate remains blocked until that disposable
bench is ready.

The coding worktree and the bench's `apps/pulse` checkout are separate. Sync
reviewed commits through Git; never copy or symlink a development worktree into
a bench. Prefer one integrated disposable bench at runtime gates rather than a
bench per worker. Do not run schedulers/workers in several disposable benches
concurrently unless their queue isolation has been explicitly verified.

Never tear down `pulse-reference`.
Never flush shared Redis.
Never hand-roll bench provisioning.
Do not tear down a disposable validation bench until the user has approved it.

## Implementation posture

Prefer upgrading the existing model over creating a parallel one. The current
repo already has:

- `SOP Template`
- `SOP Assignment`
- `SOP Run`
- `SOP Run Item`
- score APIs
- operations and insights APIs
- React dashboard, tasks, team, templates, and insights pages

These are prototype implementations. Item-progress scoring, recursive combined
score averages, `Open/Closed/Locked`, and date-only overdue checks are current
behavior to migrate, not product contracts to preserve.

## Change ownership

Parallel work is safe only with disjoint write sets:

- a schema owner exclusively edits a given DocType JSON and its migration in a
  wave;
- a domain owner edits `pulse/domain/` and its focused tests;
- an endpoint owner adapts an existing API module to the frozen interface;
- a frontend owner edits the page, service, and types named by the task;
- the integration owner alone resolves cross-task conflicts and updates shared
  compatibility keys.

Two agents may inspect the same file. They may not edit it in parallel, even if
their task cards appear in different lanes.

## Definition of ready

A task is ready for an agent when it has:

- a task ID;
- dependencies;
- a small scope;
- allowed files;
- exact done checks;
- verification guidance;
- explicit non-goals.
- no unresolved product or schema decision hidden in the steps.

## Definition of done

A task is done when:

- the code or docs match the task card;
- existing behavior outside scope is preserved;
- verification has passed or the reason it could not run is recorded;
- the handoff note names any known unresolved risk.
- new domain behavior is covered at its interface, not only through a page
  screenshot or internal helper test.
