# CLAUDE.md

This file is the Claude-compatible entry point for the Pulse repository.
Follow [`AGENTS.md`](AGENTS.md) as the canonical project and bench guidance.

Pulse is a Frappe 16 application with a React 19/Vite frontend. The backend
package is `pulse/`; the frontend is `frontend/`. Keep the Frappe app checkout
and the frontend build output in the same bench app directory. Run backend
commands inside the shared Frappe devcontainer and frontend checks from
`frontend/`.

Before bench work, read [`DOCKER_BENCH.md`](DOCKER_BENCH.md). The persistent
Pulse reference bench is protected; use the `frappe-multihand` `mh` workflow
for all additional benches and never copy files directly into a running bench.

Common checks:

```bash
cd frontend && yarn typecheck && yarn lint && yarn build
cd /workspace/benches/<assigned-feature-bench>
bench --site <assigned-feature-site> migrate
bench --site <assigned-feature-site> run-tests --app pulse
```

The placeholders above must resolve to the disposable bench assigned to the
task. Never migrate, seed, or run write-capable tests on `pulse-reference`.

Use the built-in demo loader for local evaluation when needed:
`bench --site <assigned-feature-site> pulse-load-demo`.
