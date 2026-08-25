# Execution Status Board

Status: integration-owner maintained

Worker pool: GPT-5.4 medium, Kimi CLI, Antigravity Gemini Flash Low, and
OpenCode Go MiniMax M3 (`opencode-go/minimax-m3`). MiniMax M2.7 is disabled
after two stale runs. Claude Haiku is the
execution fallback; Claude Sonnet medium and Codex perform final review.

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
| P0 | blocked | integration owner | - | none | waits for S0-T00, S0-T02, contract acknowledgement |

## First-milestone waves

| Wave | Tasks | State | Integration evidence |
| --- | --- | --- | --- |
| W1 Foundation/schema | S1-T00, S1-T01, S1-T02, S4-T01 | blocked | test discovery + clean/legacy migrate |
| W2 Domain | S1-T03, S1-T04, S1-T07, S2-T00, S2-T01, S1-T08 | blocked | contracts + generation/finalization retry checks |
| W3 Execution/setup | S1-T05, S4-T03, S2-T02, S2-T05, S1-T09 | blocked | submit/finalize/scope/command checks |
| W4 Explainability | S1-T06, S2-T03, S3-T01, S3-T02 | blocked | fixture 1/0/.5/null + scoped queries |
| W5 Product UI | S1-T10, S2-T06, S1-T11, S2-T04, S3-T03, S3-T04 | blocked | setup-to-submission + manager scenarios |

## Worker handoffs awaiting integration

| Task | Commit(s) | Verification | Conflict risk | Decision |
| --- | --- | --- | --- | --- |
| - | - | - | - | - |

## Status update rules

1. Move a task to `ready` only when every dependency is `verified`.
2. Record one owner, branch/worktree, and disposable bench before `active` for
   any schema/runtime task.
3. Move to `review` only with a clean diff, handoff note, and verification.
4. Move to `merged` after integration-owner review, not worker self-report.
5. Move to `verified` only after the wave gate runs on the integrated branch.
6. Record the exact failure under Evidence or blocker; never use only “tests
   failed”.
