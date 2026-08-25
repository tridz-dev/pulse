# CONTEXT — Pulse Domain

This file is the compact domain glossary and project context for Pulse. The detailed product decisions and delivery plan live in [`docs/PRODUCT_PLAN.md`](docs/PRODUCT_PLAN.md). Bench lifecycle and local runtime instructions live in [`DOCKER_BENCH.md`](DOCKER_BENCH.md).

## Product context

Pulse helps organisations monitor whether recurring operating procedures are completed on time. Its first product is SOP compliance: generated runs, binary completion scoring, hierarchy roll-up, drill-down, and manager action. Pulse is not the source of truth for HR, ERP, POS, inventory, or other operational records.

The two important dimensions are intentionally separate:

- **Compliance** — whether the assigned SOP run happened on time.
- **Evaluation** — what the work produced or whether a required check passed.

The initial release uses the compliance gauge only. Evaluation templates and gates are a separate extension surface.

## Canonical glossary

- **Organisation:** customer boundary containing people, hierarchy, policies, and records.
- **Hierarchy:** canonical reporting tree used for responsibility and score roll-up.
- **SOP Template:** versioned definition of recurring or on-demand work.
- **SOP Assignment:** relationship between a template and the person or scope responsible for it.
- **SOP Run:** one generated occurrence of an assignment for a schedule window.
- **Compliance:** binary execution result for a generated run: completed on time or not.
- **Evaluation:** separate outcome such as pass/fail, numeric threshold, selectable result, or evidence review.
- **Gate:** required evaluation, approval, evidence, location, or external confirmation that can block completion.
- **Evidence:** proof attached to a run or evaluation.
- **Event:** immutable fact received from a person, Pulse, or an external system.
- **Action:** requested side effect such as a notification, webhook, message, or external update.
- **Mission Control:** manager view of current health, unresolved work, ownership, duration, and next action.

## Core invariants

- Not-yet-generated runs have no score and are excluded from the denominator.
- Generated runs score 100% when completed on time and 0% when they reach the deadline incomplete.
- Initial aggregation is equally weighted; future weighting must remain configurable.
- The high end of the gauge is green; the low end is red.
- Historical runs preserve the effective template, assignment, deadline, and hierarchy context at generation time.
- Finalized records are immutable; corrections use linked amendments or adjustments.
- Compliance and evaluation remain separate by default.
