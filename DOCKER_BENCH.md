# Pulse Docker Bench

Pulse uses the shared local Frappe devcontainer that also hosts Huf benches.
This document records the Pulse-specific contract; live ports and credentials
are authoritative in `BENCH_IDENTITY.md` and the shared registry.

## Infrastructure

- Container: `frappe_docker_devcontainer-frappe-1`
- Host bench root: `/Users/safwan/Code/Docker/frappe_docker/benches`
- Container bench root: `/workspace/benches`
- MariaDB service: `mariadb` (root password is local-dev only)
- Redis services: `redis-cache` and `redis-queue`
- Multihand CLI: `/workspace/development/mh-tools/mh`
- Companion script symlink: `/workspace/development/mh-scripts/`
- Registry: `/workspace/benches/registry.json`
- Manifest: `/workspace/benches/workspaces.json`

## Pulse workspace

The `pulse` manifest declares Frappe `version-16` and Pulse `main` as the
primary app. Its reference bench is `pulse-reference`. Feature benches must be
created with `mh new` so ports, Redis DBs, worktrees, and registry entries are
allocated atomically.

Canonical invocation inside the devcontainer:

```bash
BENCH_ROOT=/workspace/benches /workspace/development/mh-tools/mh <command>
```

For a feature task, the integration owner assigns a unique branch and track:

```bash
BENCH_ROOT=/workspace/benches /workspace/development/mh-tools/mh new pulse-<task> \
  --workspace pulse \
  --branch task/<task> \
  --track-dir /workspace/development/tracks/pulse-<task>
```

Run `mh doctor` and `mh list` first. Provisioning must stop if no safe port,
Redis DB, registry allocation, workspace entry, or source branch is available.
Do not work around capacity or registry errors manually.

## Start and verify

```bash
docker exec frappe_docker_devcontainer-frappe-1 bash -lc \
  'cd /workspace/benches/pulse-reference && nohup bench start > logs/bench-start.log 2>&1 & disown'
curl -H 'Host: pulse-reference.local' http://127.0.0.1:<web-port>/api/method/ping
```

The site must be in developer mode because multiple benches share Redis asset
services. Re-run `bench build` after frontend changes, then restart the full
`bench start` process group when testing runtime changes.

## Safety

Never tear down or mutate `pulse-reference`. Never use `redis-cli FLUSHALL`.
Never copy a development worktree into `apps/pulse`; update the independent
bench checkout through Git.
