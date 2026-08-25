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
| W1 Foundation/schema | S1-T00 ✅, S1-T01 ✅, S1-T02 ✅, S4-T01 ✅ | **complete (code); not runtime-verified** | all four merged; static + dispatcher-reviewer diff-check only |
| W2 Domain | S1-T03 ✅, S1-T04 ✅, S1-T07 ✅, S2-T00 ✅, S2-T01 ✅, S1-T08 ✅ | **complete (code); not runtime-verified** | all six merged — idempotent generation, compliance scoring, and deadline finalization now form a closed loop |
| W3 Execution/setup | S1-T05 ✅, S4-T03 (not started), S2-T02 ✅, S2-T05 ✅, S1-T09 ✅ | partial | 4/5 merged; only S4-T03 (Immutable finalized runs) remains, now dependency-ready (needs S1-T05 ✅ + S4-T01 ✅) |
| W4 Explainability | S1-T06 (not started), S2-T03 (not started), S3-T01 (not started), S3-T02 (not started) | ready to start | none merged yet; S2-T03/S3-T01/S3-T02 all now dependency-ready (need S1-T04 ✅/S2-T00 ✅/S2-T02 ✅); S1-T06 needs S4-T03 first |
| W5 Product UI | S1-T10 ✅, S2-T06 ✅, S1-T11 ✅, S2-T04 (not started), S3-T03 (not started), S3-T04 (not started) | partial | 3/6 merged; S2-T04/S3-T03/S3-T04 blocked on W4 analytics tasks |

**19 of ~35 backlog tasks merged** into `track/pulse-first-milestone` as of
this resume session (2026-08-26, same day as the original handoff). W1 and W2
are fully code-complete — the core lifecycle loop (idempotent scheduled
generation → run-level compliance scoring → deadline finalization →
concurrency-safe user completion) is closed. All merges are code-complete and
statically self-reviewed (by the dispatching CLI, a dedicated Claude
dispatcher-reviewer subagent, and/or the integration owner directly) —
**none have run on a live Frappe bench yet**. The first migration gate
(provisioning a disposable Frappe 16 bench and running `bench migrate` +
focused tests) is still the next hard verification step before any of this
can be called done, per the original resume plan — nothing here should be
read as "working," only as "written and reviewed."

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

## Status update rules

1. Move a task to `ready` only when every dependency is `verified`.
2. Record one owner, branch/worktree, and disposable bench before `active` for
   any schema/runtime task.
3. Move to `review` only with a clean diff, handoff note, and verification.
4. Move to `merged` after integration-owner review, not worker self-report.
5. Move to `verified` only after the wave gate runs on the integrated branch.
6. Record the exact failure under Evidence or blocker; never use only “tests
   failed”.
