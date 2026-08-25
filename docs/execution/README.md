# Pulse Execution Pack

Status: planning baseline for parallel agent execution

This folder converts the product plan into small implementation tasks that can
be handed to focused, lower-capability agents. Each task should be executed as a
small, scoped change with its own verification and handoff note.

## Canonical inputs

Read these before taking a task:

- [Product plan](../PRODUCT_PLAN.md): domain decisions and milestone shape.
- [Domain context](../../CONTEXT.md): compact glossary and invariants.
- [Agent reference](../../AGENTS.md): repository, bench, and runtime contract.
- [Docker bench](../../DOCKER_BENCH.md): local Frappe bench safety rules.

## Execution docs

- [Start here / resume ledger](START-HERE.md): exact paused state and next steps.
- [Operating model](00-operating-model.md): how to split and run work safely.
- [Dependency map](01-dependency-map.md): task graph and parallel lanes.
- [Parallel workstreams](02-parallel-workstreams.md): what can run together.
- [Task backlog](03-task-backlog.md): scoped task cards for implementation.
- [Agent brief template](04-agent-brief-template.md): copy/paste prompt shape.
- [Acceptance and handoff](05-acceptance-and-handoff.md): checks before merge.
- [Domain contracts](06-domain-contracts.md): frozen lifecycle, score, schedule,
  hierarchy, and response meanings.
- [Current model inventory](model-inventory.md): prototype-to-contract mapping.
- [Execution status](07-execution-status.md): owner, wave, bench, and integration
  evidence board.

## Milestone target

The first milestone is not "all future Pulse". It is a usable SOP compliance
vertical slice for one organisation per Frappe site, with login users already
provisioned:

1. create a three-level organisation hierarchy;
2. create a recurring SOP;
3. assign it to a person;
4. generate a due run with the right local deadline;
5. submit one run and miss another;
6. show high score as green and low score as red;
7. roll the score up through the hierarchy;
8. drill from manager gauge to the missed run;
9. preserve enough history to explain what happened.

Implementation agents must treat the [domain contracts](06-domain-contracts.md)
as the target when current prototype behavior or older agent notes disagree.

Do not mix generic evaluations, quality checks, WhatsApp, Telegram, geofencing,
camera-only capture, or external ERP/POS integrations into the first execution
slice. Those have extension points in the task graph, but they are later lanes.
