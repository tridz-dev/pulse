# Pulse Gap-Fix Plan — dependency graph + execution tracker

Source: [product-gap-analysis.md](./product-gap-analysis.md) (23 findings, A1–A7, B1–B6, C1–C10).
Owner: Sonnet (this session) — plans, delegates, steers, integrates, accepts.
Workers: Haiku by default; escalate only on demonstrated difficulty.

## Readiness classes

- **READY** — bounded, no open design question, executable by Haiku now.
- **NEEDS-SCOPE** — real feature work; a scoping pass (data model / API surface
  / UX flow) must produce a bounded spec before implementation tasks exist.
  Scoping itself is delegated (Sonnet-tier), not skipped.
- **BLOCKED** — waits on another finding's fix landing first.

## Dependency graph (waves = parallel batches; edges = hard blockers)

```
WAVE 0  (parallel, independent files — READY now)
  F-C9   backend: authorize 3 hierarchy read endpoints + permission_query_conditions
  F-B1   frontend: pass `total` into scoreStatus at Operations.tsx:577 + fix meter
  F-B2   frontend: exclude nulls from Dashboard numerator/denominator (232-233, 252-256)
  F-B6   frontend: give --none a light-theme value in index.css
  F-A1   frontend: sidebar collapse control — move to rail edge, add label
  F-A3   frontend: PeriodToggle contrast fix (active state)
  F-A2   frontend: replace fake-keyboard search wiring with shared open-state
  F-B5   frontend: mark incomplete trailing bucket in trend charts (shared helper)
        (each touches disjoint files — no ordering needed among these 8)

        │
        ├── F-C9 done ──► WAVE 1a can start (nothing else depends on C9 in this pass;
        │                  flagged for a P2 follow-up sweep of remaining endpoints)
        │
        ├── F-B1 + F-B2 done ──► WAVE 1b: B3, B4 verification (same root cause,
        │                         confirm both surfaces now agree)
        │
        └── F-A2 done ──► WAVE 1c: A1 depends on A2's shared "open" state existing
                            if we lift search state — see note in F-A2 task

WAVE 1  (parallel — depends on Wave 0 landing in same files)
  F-B3   frontend: reconcile failure count (Dashboard "View failing runs (N)")
           — depends on F-B2 (same data path, must not re-diverge)
  F-B4   verify: parent/child score parity now holds (post F-B1) — Haiku review task,
           not a code change if F-B1 is correct
  F-A4   frontend: Topbar — give the header a job (persistent title + scope strip)
           — depends on F-C10-scope (needs the shared scope model's shape decided
           first, or the header will just re-invent its own state) — see Wave 2
  F-A5   frontend: TreeRow level prop widened to arbitrary depth + real indent rail;
           separate single-click-expand from a visible drill-down affordance
  F-A6   frontend: Operations — fix date-mutation bug in getPeriodRange; fix
           pagination effect deps; (full unification with shared scope model is
           F-C10, tracked separately — this task is the standalone bugfix half)
  F-A7   frontend: Insights — collapse periodType+dateRange to one control OR
           make Custom/Demo-data explicit alternate mode, remove the "Custom
           renders as Day" lie — standalone half; full unification is F-C10

WAVE 2  (SCOPING passes — Sonnet-tier, produce bounded specs, not code)
  S-C10  scope: one shared {scope, period} model — consumed by Dashboard,
           Operations, Insights, Team. Output: a small typed context/hook spec
           + migration plan for the 3 pages currently hand-rolling period state.
  S-C1   scope: action-loop data model — acknowledge/assign/waive/snooze/escalate
           states on SOP Run + Corrective Action, required API surface, required
           permission checks. Escalation target resolution already exists
           (domain/escalation.py) — scope how it plugs into a real send path.
  S-C2   scope: notification delivery — channel choice (email first, most
           bounded), template set, trigger points (run overdue, run failed,
           escalation fired), opt-in/quiet-hours if any.
  S-C5   scope: coverage/delegation model — shift bounds? explicit "mark absent
           day" per employee? bulk reassignment UI? Needs a product decision,
           not just an engineering one — flag for human sign-off before Wave 3.

        │  (each scoping output becomes the Wave-3 task list for that area)
        ▼

WAVE 3  (parallel implementation, gated on Wave 2 specs)
  F-C10  implement shared scope model (from S-C10) — BLOCKS: A4, A6-unification,
           A7-unification landing as "done for real" rather than standalone patches
  F-C1   implement action-loop backend + UI (from S-C1) — large, will itself
           fan out into: DocType/status fields, API endpoints, UI actions per
           finding row, permission checks
  F-C2   implement notification delivery (from S-C2) — backend job/trigger +
           template; frontend bell becomes real (removes the C2/A4 "stub" note)
  F-C3   Corrective Action queue page — READY NOW, not blocked on scoping:
           backend already has the DocType (status/assigned_to/priority/
           resolution/evidence fields) and one create endpoint
           (create_corrective_action_for_run). Needs: list/filter/update/
           resolve endpoints + a frontend queue page using existing Table/
           StatusChip primitives. Move to WAVE 0 execution — see note below.
  F-C5   implement coverage/delegation (from S-C5, pending human sign-off)

WAVE 4  (depends on Wave 3 landing — polish/adoption, lower urgency)
  F-C4   mobile/offline execution path — largest single item, own sub-plan
  F-C6   onboarding: org import, template library, bulk assignment
  F-C7   evidence review + gates
  F-C8   amendment/audit-trail surface
  F-C-remaining   broader server-side scope audit beyond the 3 endpoints in C9

WAVE 5  (final)
  V-ALL  Haiku verification swarm: typing/lint/build across every touched file,
           dead code, API/contract consistency, security spot-check on any new
           endpoint, cross-module consistency (esp. scope model + status chips)
  R-OPUS Opus adversarial review: goal + this plan + diffs + V-ALL results +
           unresolved concerns (S-C5 sign-off, C4/C6/C7/C8 scope) — one pass,
           not a re-review from zero
  CLOSE  Sonnet converts Opus findings into scoped fix tasks, delegates,
           revalidates, closes
```

**Correction to the graph above**: F-C3 (Corrective Action queue) has no real
blocker — it's promoted into Wave 0 execution alongside the other 8 READY
items, run as a 2-task split (backend endpoints, then frontend page depends on
backend landing).

## Execution tracker (updated live as agents report)

| ID | Wave | Model | Status | Files | Notes |
|---|---|---|---|---|---|
| F-C9 | 0 | Haiku | pending | `pulse/api/operations.py`, `pulse/hooks.py` | security, highest priority |
| F-B1 | 0 | Haiku | pending | `frontend/src/pages/Operations.tsx` | |
| F-B2 | 0 | Haiku | pending | `frontend/src/pages/Dashboard.tsx` | |
| F-B6 | 0 | Haiku | pending | `frontend/src/index.css` | |
| F-A1 | 0 | Haiku | pending | `frontend/src/components/layout/Sidebar.tsx` | |
| F-A3 | 0 | Haiku | pending | `frontend/src/components/shared/period-toggle.tsx` | |
| F-A2 | 0 | Sonnet | pending | `Sidebar.tsx`, `CommandSearch.tsx`, `AppLayout.tsx` | cross-file state lift, escalate |
| F-B5 | 0 | Haiku | pending | `Insights.tsx`, `Dashboard.tsx`, new shared helper | |
| F-C3a | 0 | Haiku | pending | `pulse/api/operations.py` or new `pulse/api/corrective_actions.py` | backend first |
| F-C3b | 0→1 | Haiku | blocked on F-C3a | new `frontend/src/pages/CorrectiveActions.tsx` | |
| F-B3 | 1 | Haiku | blocked on F-B2 | `Dashboard.tsx` | |
| F-B4 | 1 | Haiku | blocked on F-B1 | verify only | |
| F-A5 | 1 | Sonnet | pending | `tree-row.tsx`, `Operations.tsx` | escalate: layout-affecting |
| F-A6 | 1 | Haiku | pending | `Operations.tsx` | standalone bugfix half |
| F-A7 | 1 | Haiku | pending | `Insights.tsx` | standalone bugfix half |
| F-A4 | 1→2 | Sonnet | blocked on S-C10 partial | `Topbar.tsx` | may ship a minimal version now, full version after C10 |
| S-C10 | 2 | Sonnet | pending | scope doc only | |
| S-C1 | 2 | Sonnet | pending | scope doc only | |
| S-C2 | 2 | Sonnet | pending | scope doc only | |
| S-C5 | 2 | Sonnet | pending | scope doc only, **needs human sign-off before Wave 3** | |
| F-C10 | 3 | Sonnet | blocked on S-C10 | multi-file | |
| F-C1 | 3 | Sonnet+Haiku fan-out | blocked on S-C1 | multi-file | |
| F-C2 | 3 | Sonnet+Haiku fan-out | blocked on S-C2 | multi-file | |
| F-C5 | 3 | blocked on S-C5 sign-off | | | **held for human decision** |
| F-C4 | 4 | not started | | | own sub-plan when reached |
| F-C6 | 4 | not started | | | |
| F-C7 | 4 | not started | | | |
| F-C8 | 4 | not started | | | |
| V-ALL | 5 | Haiku swarm | not started | | |
| R-OPUS | 5 | Opus | not started | | |

## Rules for this run

- Branch: continue on `design/ui-completion-w0-w4` (already deployed to
  `pulse-w1w5-reverify`) unless a fix requires backend migration in which case
  note it explicitly — backend changes need `bench migrate` on the bench after
  landing.
- No task touches a file another in-flight task owns. Wave 0's 9 tasks are
  file-disjoint by construction (verified above) — safe to fire all at once.
- Every Haiku task gets: exact file(s), exact current buggy code (quoted),
  exact required fix, constraints (no unrelated changes), and a validation
  command (`tsc --noEmit`, `eslint <file>`, or a `bench console` snippet for
  backend).
- S-C5's output is NOT auto-promoted to Wave 3 — flag to the user for sign-off
  since it's a product/fairness decision, not just an engineering one.
