# Acceptance and Handoff

Use this document when deciding whether a set of tasks is ready to combine.

## First milestone acceptance scenario

The first usable milestone is ready when a clean local site with existing
Frappe login users can demonstrate through the Pulse frontend:

1. an administrator creates departments and a three-level hierarchy;
2. an administrator creates a daily SOP schedule and assigns it to an operator;
3. one generated run is completed on time;
4. one generated run is left incomplete until overdue or failed;
5. completed generated run contributes 100%;
6. missed generated run contributes 0%;
7. not-yet-generated future work does not affect score;
8. generated work before its deadline remains pending and does not affect score;
9. a person with no eligible runs displays no data, not 0%;
10. manager inherited score reflects descendant runs exactly once;
11. manager can switch or request personal score separately;
12. the gauge shows low as red and high as green;
13. manager can drill down to the failing person, SOP, and run;
14. a failed result cannot be rewritten to Passed through normal submission;
15. generated run still shows the effective template, assignment, deadline, and
    hierarchy context after later changes.

## Merge-readiness checks

Before combining several task outputs:

- Check for DocType JSON conflicts.
- Check that API response names are consistent between backend and frontend.
- Check that scoring still follows the binary run-level rule.
- Check that frontend score colors use high-is-good semantics.
- Check that the demo scenario still seeds cleanly.
- Run clean-site and legacy-record migrations if schema changed.
- Record backfill limitations and recovery/rollback steps for every data patch.
- Run the focused domain tests and the app test suite on the integrated branch.
- Run a frontend build if frontend files changed.
- Confirm the app shell and referenced JS bundle both return successfully; a
  ping response alone is not a frontend health check.
- Record every retained compatibility key and its removal task.

## Cross-task contract checks

### Scoring contract

Compliance score is based on generated SOP runs:

- completed on time: 100%;
- generated and incomplete after due deadline: 0%;
- generated and pending before deadline: excluded;
- not generated: excluded;
- no eligible runs: null/no data;
- no partial checklist item score in first milestone;
- no combined compliance/evaluation score.

### Hierarchy contract

Default manager view is descendants-only inherited subtree health. Personal
score is separate. Each eligible descendant run is counted once. The first
model uses one active `reports_to` chain and fails closed on a cycle.

### History contract

Generated runs preserve effective context. Finalized records should not be
silently rewritten. Failed compliance cannot become Passed through normal
submission; later correction uses a linked amendment/event.

### UI contract

The frontend must let a small organisation operate without opening raw Frappe
DocType lists for the common path.

## Wave verification commands

Use the assigned disposable bench/site and replace placeholders with its
identity values:

```text
bench --site <site> migrate
bench --site <site> run-tests --app pulse
cd apps/pulse/frontend && npm run typecheck
cd apps/pulse/frontend && npm run build
bench build --app pulse
```

Run only the commands relevant to the wave, then perform the browser scenario
on the integrated branch. Never run migration, seed, scheduler, or submission
checks against `pulse-reference`.

## Final handoff summary

When a milestone batch is complete, write a short summary with:

- task IDs completed;
- important changed files;
- verification results;
- known gaps against [Product plan](../PRODUCT_PLAN.md);
- next recommended task IDs.
