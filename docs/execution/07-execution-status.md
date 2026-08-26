# Execution Status Board

Status: integration-owner maintained

Paused handoff: read [START-HERE.md](START-HERE.md) before resuming any worker,
merge, or bench action.

Worker pool (2026-08-26 resume): Kimi CLI, Antigravity (Gemini), Claude
(dispatch + dispatcher-reviewer subagents, and execution fallback). Codex is
out of quota for this session (hit its usage limit; retry after ~03:02) and is
**not currently in rotation**. Cursor CLI is unauthenticated in this
environment and is **excluded from rotation**. OpenCode is **excluded from rotation** for this session: diagnosed root
cause is this machine's `~/.config/opencode/opencode.jsonc`, whose default
agent (`oc-router`) has no `write`/`edit` tool available at all regardless of
`--auto`/model choice; the one subagent with write access (`oc-qwen-coder`)
is only reachable via unreliable two-hop `task`-tool delegation, not a
scriptable one-shot dispatch. MiniMax M2.7 remains disabled after earlier
stale runs. Fallback order when a lane's primary CLI fails: Claude
Haiku → Antigravity → Kimi → (further down the ladder as needed).

Orchestration pattern in this resume: the integration owner (top-level agent)
plans tasks, prepares bounded per-task prompts, and dispatches each to an
external CLI in its own git worktree; a dedicated Claude dispatcher-reviewer
subagent per lane waits for that CLI, diff-reviews the result against the
task's allowed-files/done-checks, fixes small issues directly, and commits on
the task's own `agent/*` branch. The integration owner alone reviews and
cherry-picks into `track/pulse-first-milestone` — no subagent merges into
integration.

Workspace note: this track's worktrees (integration + all `agent/*` task
worktrees) were relocated from
`/Users/safwan/Code/Docker/frappe_docker/development/tracks/PulseFirstMilestone`
into `/Users/safwan/Code/Experiments/Pulse/tracks/PulseFirstMilestone` via
`git worktree move` (no history rewrite). See the workspace root
[README.md](../../../../../README.md) for why and the new convention.

Only the integration owner edits this file during a wave. Worker agents report
their status in handoff notes; they do not race to update this board.

Allowed states: `blocked`, `ready`, `active`, `review`, `merged`, `verified`.

## Planning and discovery

| Task/gate | State | Owner | Branch/worktree | Bench | Evidence or blocker |
| --- | --- | --- | --- | --- | --- |
| S0-T00 | blocked | integration owner | - | registry/identity (read-only) | workspace/reference agree; all Redis DBs 0-15 reserved; dry run selected invalid DB 16 and attempted a denied hosts write |
| S0-T04 | active | integration owner | - | repair task; approval before cleanup | reference backup created with DB/public/private/config files; audit found no unregistered resources; waits for approved capacity reclamation and dry-run repair/report |
| S0-T01 | blocked | integration owner | - | pulse-reference (read-only) | partial evidence: Frappe 16.31.0, Pulse main, ping 200, JS/CSS bundles 200; waits for S0-T04 and verified S0-T00 rerun |
| S0-T02 | verified | integration owner | main working tree | none | `model-inventory.md`; four-lane read-only inventory; all ten core DocTypes mapped; `git diff --check` passed |
| S0-T03 | blocked | unassigned | - | none | waits for S0-T01/T02 |
| P0-code | verified | integration owner | `track/pulse-first-milestone` | none | S0-T02 verified; contracts acknowledged; independent host worktrees active |
| P0-runtime | blocked | integration owner | - | none | waits for S0-T00/S0-T04 and S0-T01 before migration/runtime work |

## First-milestone waves

| Wave | Tasks | State | Integration evidence |
| --- | --- | --- | --- |
| W1 Foundation/schema | S1-T00 ✅, S1-T01 ✅, S1-T02 ✅, S4-T01 ✅ | **complete; runtime-verified** | all four merged; full app test suite green on disposable bench `pulse-w1w5-verify` |
| W2 Domain | S1-T03 ✅, S1-T04 ✅, S1-T07 ✅, S2-T00 ✅, S2-T01 ✅, S1-T08 ✅ | **complete; runtime-verified** | idempotent generation, compliance scoring, and deadline finalization form a closed loop; all pass on a live bench |
| W3 Execution/setup | S1-T05 ✅, S4-T03 ✅, S2-T02 ✅, S2-T05 ✅, S1-T09 ✅ | **complete; runtime-verified** | finalized-run mutation blocked at the DocType level; assignment override-uniqueness rule verified live |
| W4 Explainability | S1-T06 ✅, S2-T03 ✅, S3-T01 ✅, S3-T02 ✅ | **complete; runtime-verified** | deterministic acceptance fixture and period/trend logic exercised on a live bench |
| W5 Product UI | S1-T10 ✅, S2-T06 ✅, S1-T11 ✅, S2-T04 ✅, S3-T03 ✅, S3-T04 ✅ | **complete; runtime-verified** | backend endpoints these pages consume are runtime-verified; `yarn typecheck` and `yarn build` both pass clean |

**27 of ~35 backlog tasks merged** into `track/pulse-first-milestone` as of
this resume session (2026-08-26, same day as the original handoff). **W1
through W5 — the entire actively-planned first-milestone scope — is fully
code-complete, and the backend (`pulse/`) is now runtime-verified**, not just
statically reviewed. The core lifecycle loop (idempotent scheduled generation →
run-level compliance scoring → deadline finalization → concurrency-safe user
completion → immutability backstop), the analytics layer (hierarchy roll-up,
scoped failure list, timezone-aware score trends, manager drill-down from
gauge to failing run, Mission Control's exact attention-ordering rule,
null-vs-zero-safe trend charting), and the deterministic acceptance fixture
are all in place. What remains in the full backlog is S4-T02/S4-T04
(lightweight design-doc-only tasks, no code) and S5/S6, which stay explicitly
out of scope for this milestone per the frozen product decisions in
`CONTEXT.md`.

**Runtime verification gate (backend): PASSED.** A disposable Frappe 16 bench
(`pulse-w1w5-verify`, provisioned from `track/pulse-first-milestone`, isolated
Redis/registry from `pulse-reference`) ran the full `pulse` app test suite —
**82 of 82 tests pass, 0 failures, 0 errors** — after five iterate-and-sync
rounds fixing seven genuine bugs the static/dispatcher review passes had
missed (see below). This bench is left running for manual inspection rather
than torn down.

**Frontend gate: `yarn typecheck` and `yarn build` PASS clean.** `yarn lint`
surfaces 27 pre-existing errors / 5 warnings (unused vars, `any` types,
React-effect patterns) scattered across files this session's tasks did not
touch — these are pre-existing hygiene debt, not regressions from this
session's work, and are not blocking. One real bug was caught by
`tsc --noEmit`: `Operations.tsx` read a `combined_score` (snake_case)
fallback field that the type (and the service-layer normalization in
`operations.ts`) never actually produces — dead/incorrect code, removed.

**Acceptance-fixture gate: PASSED.** `bench pulse-load-acceptance-fixture`
loaded cleanly on `pulse-w1w5-verify`; the three generated runs for Owen
Patel match the spec's run keys, due_at values, and compliance_result
exactly (`A1:2026-08-24` Passed, `A2:2026-08-24` Failed, `A1:2026-08-25`
Pending). `get_compliance_score` confirms the mixed period (`2026-08-24`,
one Passed + one Failed) returns exactly `score: 0.5, passed_runs: 1,
failed_runs: 1, eligible_runs: 2` — the spec's central `1/2 = 0.5` case —
and Nora Singh (no assignment, no generated run) returns `score: null` for
both personal and inherited scope, exactly as specified.

**All planned verification gates for this session are now green:** backend
test suite (82/82), frontend typecheck/build, and the acceptance-fixture
score contract. Remaining backlog items (S4-T02/S4-T04 design docs, and
S5/S6) are out of scope for this milestone per `CONTEXT.md`.

Seven real bugs were caught and fixed only once the suite actually ran on a
live bench (not caught by static/dispatcher review), reinforcing why this
verification step matters:
- `pulse.tasks._generate_runs_for_frequency`: blindly overwrote tzinfo on an
  already-aware mocked `now_datetime()` return value via `.replace()`,
  silently shifting the instant by the site's UTC offset (`Asia/Kolkata`,
  +5:30) instead of converting it — this was the root cause of the
  "zero runs generated" failure that blocked this gate for a full session.
- `pulse.api.assignments.create_assignment`: its idempotent existing-check
  filtered `local_start_time_override` (a Time field) against `""`, but
  Frappe stores an empty Time field as `NULL` — so a second identical call
  never found the first row and fell through to a genuine duplicate insert,
  which the doctype's uniqueness guard correctly rejected.
- `pulse.domain.hierarchy.get_descendants_scope` /
  `get_manager_plus_descendants_scope`: returned employees in DFS
  tree-walk order, inconsistent with sibling `get_organisation_scope`
  (always sorted) — sorted both for a consistent, deterministic contract.
- Four test-fixture bugs (missing `run_items` rows in two files, a missing
  `User` link in an insights fixture, an assignment test comparing a `date`
  to its ISO string, and a test accessing `.template`/`.employee` on an
  assignment name string instead of the doc) — all fixed in the affected
  test files.

Process note for future bench runs on this branch: `pulse.tasks` deliberately
commits per-created-run inside the generation loop (crash-safety for the real
scheduled job), which defeats `FrappeTestCase`'s per-test rollback whenever a
test errors before its own `tearDown`. A crashed run-generation-related test
leaves permanent orphan records in the site. Several of this session's
early "failures" were actually this residue compounding across debug
iterations, not code bugs — resolved by a thorough `%@example.com`/`%Test%`
sweep-and-delete before the run that finally went green. Any future bench
session on this same disposable site should do the same sweep first if a
run-generation test has ever errored on it before.

Two real bugs were caught and fixed during this session's review passes (not
just style nits), both worth noting for anyone auditing the process:
- S1-T02: two field names in the schedule schema diverged from the frozen
  contract table (`docs/execution/06-domain-contracts.md` §7) and were
  corrected before merge.
- `pulse.tasks`: `now_datetime()` returns a naive datetime in the Frappe
  *site* time zone, not UTC; both `_generate_runs_for_frequency` (S1-T03) and
  `finalize_overdue_runs` (S1-T07) needed an explicit conversion before
  comparing against UTC-stored `due_at` values, or scheduling would silently
  drift by the site's UTC offset. Caught in `2afabf9`'s follow-on `8a033bc`/
  `6df2d19`, not in the original review pass — a reminder that this class of
  bug is easy to miss on first read.

## Worker handoffs awaiting integration

| Task | Commit(s) (on integration) | Verification | Conflict risk | Decision |
| --- | --- | --- | --- | --- |
| S1-T00 | `62d35cb` | static self-review | none | merged |
| S0-T03 | `9076a79` | reviewed by integration owner | none | merged |
| S1-T01 | `3c56ea3` | dispatcher-reviewer (Antigravity output) | none | merged |
| S2-T01 | `f0b08ba` | dispatcher-reviewer (Claude fallback output, after OpenCode stalled) | none | merged |
| S2-T00 | `990c0b3` | dispatcher-reviewer (Kimi output) | none | merged |
| S1-T02 | `ae52607` | dispatcher-reviewer, fixed 2 field-name mismatches vs contract table before commit | none | merged |
| S2-T05 | `9732a50` | dispatcher-reviewer, fixed an invalid test fixture before commit | none | merged |
| S1-T08 | `4930e35` | dispatcher-reviewer, fixed a missing required test field before commit | none | merged |
| S2-T06 | `9dc63bd` | dispatcher-reviewer (Claude fallback, after cursor-agent auth failure) | none | merged |
| S1-T09 | `7d0b027` | dispatcher-reviewer (Kimi output), no fixes needed | none | merged |
| S1-T04 | `158f71b` | integration owner direct review | none | merged |
| S1-T10 | `f97f0cb` + `da6e406` follow-up | dispatcher-reviewer (agy output), removed one unused import | none | merged |
| S4-T01 | `fabad5d` | integration owner direct review | none | merged |
| S1-T11 | `2afabf9` | integration owner direct review | none | merged |
| S1-T03 | `dbc8153` + `8a033bc` follow-up fix | dispatcher-reviewer, ran the pure unit tests directly, caught and fixed a real timezone bug | none | merged |
| S1-T07 | `a062a1b` | integration owner direct review | none | merged |
| tasks.py fix | `6df2d19` | integration owner, found the same timezone bug in `finalize_overdue_runs` while verifying S1-T07 against S1-T03's fix | none | merged (unscheduled fix, not a backlog task) |
| S2-T02 | `4e3b7c6` | dispatcher-reviewer (Kimi output), audit-only task, no fixes needed | none | merged |
| S1-T05 | `4dc2267` | integration owner direct review | none | merged |
| S3-T01 | `d46c9fb` | integration owner direct review | none | merged |
| S4-T03 | `18f64e0` | integration owner direct review | none | merged |
| S2-T03 | `4067b62` | dispatcher-reviewer (Antigravity output), audit-only task, fixed one float-precision test assertion | none | merged |
| S3-T02 | `58245d3` | integration owner direct review; verified only `get_score_trends` changed in a large shared file | none | merged |
| S2-T04 | `7b4972b` | integration owner direct review | none | merged |
| S1-T06 | `f2db57d` | integration owner direct review; verified `manager_path_snapshot` reuses the real `_build_manager_path` (not hand-rolled) after a mid-flight concern about a confused reasoning trace | none | merged |
| S3-T01 fix | `fea8cea` | dispatcher-reviewer, found a real `due_at` date-boundary bug (bare date string silently excluded a run due later that same day) after `594584f` was already merged; regression test added | none | merged (unscheduled fix) |
| S3-T03 | `b42333e` | integration owner direct review; verified the exact Mission Control ordering rule by tracing the comparator, removed a duplicate/dead `getComplianceScore` the agent had also added to `services/scores.ts` | none | merged |
| S3-T04 | `db04555` | integration owner direct review; verified `avg_score` never coerces null to 0 and `connectNulls={false}` renders a genuine gap, not a 0% point | none | merged |

## First milestone: actively-planned scope complete

As of `db04555`, every task in W1-W5 (the full first-milestone execution
plan) is merged. **This is a code-completeness milestone, not a
"working software" milestone** — see the runtime-verification gate above.
The literal next step, unchanged from the original resume plan: provision a
disposable Frappe 16 bench, run `bench migrate`, run every merged test file,
then `bench --site <site> pulse-load-acceptance-fixture` and confirm the
acceptance-fixture.md 1.0/0.0/0.5/null score cases through the real
`get_compliance_score` endpoint before any Sonnet/Codex final review.

## Status update rules

1. Move a task to `ready` only when every dependency is `verified`.
2. Record one owner, branch/worktree, and disposable bench before `active` for
   any schema/runtime task.
3. Move to `review` only with a clean diff, handoff note, and verification.
4. Move to `merged` after integration-owner review, not worker self-report.
5. Move to `verified` only after the wave gate runs on the integrated branch.
6. Record the exact failure under Evidence or blocker; never use only “tests
   failed”.
