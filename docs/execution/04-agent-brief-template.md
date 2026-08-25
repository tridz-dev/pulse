# Agent Brief Template

Use this template when assigning a scoped task to a small agent.

```text
You are working in the Pulse repo.

Before editing, read:
- /Users/safwan/Code/Experiments/Pulse/pulse/CONTEXT.md
- /Users/safwan/Code/Experiments/Pulse/pulse/docs/PRODUCT_PLAN.md
- /Users/safwan/Code/Experiments/Pulse/pulse/AGENTS.md
- /Users/safwan/Code/Experiments/Pulse/pulse/docs/execution/README.md
- /Users/safwan/Code/Experiments/Pulse/pulse/docs/execution/06-domain-contracts.md
- only your assigned task-card section in
  /Users/safwan/Code/Experiments/Pulse/pulse/docs/execution/03-task-backlog.md

Task ID:
<paste task ID and title>

Goal:
<paste the task goal>

Dependencies already complete:
<list completed dependency task IDs, or say none>

Base commit and branch:
<exact base SHA and worker branch>

Development worktree and validation bench:
<absolute worktree path; bench name or "not required: docs/read-only">

Allowed files:
<paste the allowed file list>

Forbidden/owned-by-another-agent files:
<paste collision list, or say none>

Steps:
<paste the task steps>

Done checks:
<paste the task done checks>

Non-goals:
<paste task non-goals>

Rules:
- Keep the change scoped to this task.
- Do not redesign unrelated surfaces.
- Do not modify shared bench provisioning.
- Do not tear down pulse-reference.
- Treat pulse-reference as read-only.
- Use the assigned disposable bench for writes, migrations, scheduler, and
  submission tests.
- Do not copy or symlink worktree files into a bench; sync tested commits
  through Git.
- If you need to edit a file outside the allowed list, stop and explain why.
- Run the smallest meaningful verification.
- Do not make a product/schema decision that the task or domain contract does
  not answer; report it as blocked.

Return:
- changed files;
- verification performed;
- behavior confirmed;
- risks or follow-up tasks;
- commit SHA(s), if the task changes code.
- migration/backfill recovery notes, if schema or stored data changes.
```

## Handoff note format

```text
Task: <ID and title>
Status: done | blocked | partial

Base commit / worker commit:
- <sha> / <sha or none>

Worktree / bench:
- <paths and bench identity, or not required>

Changed files:
- <file>

Verification:
- <check or command result>

Confirmed behavior:
- <short behavior>

Risks or follow-up:
- <short item or none>

Contract/compatibility notes:
- <compatibility key retained and removal task, or none>
```
