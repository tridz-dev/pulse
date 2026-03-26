---
name: scoring
description: >
  Score calculation, aggregation, and propagation system. Converts individual SOP 
  run performance into hierarchical KPIs that roll up from operators to executives. 
  Consult when working on performance metrics, score display, analytics, or the 
  scoring algorithm.
category: features
---

# Scoring System

## Overview

Pulse's scoring system is its key differentiator — it converts operational execution (did someone complete their checklist?) into measurable KPIs that aggregate hierarchically. An operator's missed task affects their supervisor's score, which affects their area manager's score, and so on up to the executive level.

Three score types:
- **own_score:** Individual's direct task completion
- **team_score:** Average of direct reports' combined scores
- **combined_score:** Aggregation of own + team (formula varies by context)

## Key Files

| File | Purpose |
|------|---------|
| `pulse/api/scores.py` | Score calculation APIs |
| `pulse/pulse_core/doctype/score_snapshot/` | Cached score storage |
| `frontend/src/components/shared/Gauge.tsx` | Visual score display |
| `frontend/src/components/shared/ScoreBreakdown.tsx` | Detailed score drill-down |
| `pulse/tasks.py:cache_score_snapshots()` | Hourly score caching job |

## How It Works

### 1. Individual Run Scoring

For a single SOP Run:

```
progress = (completed_items + missed_items) / total_items
score = passed_items / (total_items - not_applicable_items)
```

- **Progress:** 0-100%, how much got "addressed" (completed or missed)
- **Score:** 0-100%, quality metric (only passed items count)

Example:
```
Total: 10 items
Completed: 7, Passed: 6, Failed: 1, Missed: 2, N/A: 1

progress = (7 + 2) / 10 = 90%
score = 6 / (10 - 1) = 66.7%
```

### 2. Own Score (Employee Level)

Aggregates across all runs for an employee in a period:

```
own_score = Σ(run.score × run.total_items) / Σ(run.total_items)
```

Weighted by item count — runs with more items contribute more.

### 3. Team Score

Average of direct reports' combined scores:

```
team_score = mean(report.combined_score for report in direct_reports)
```

Only includes active reports with assigned workload.

### 4. Combined Score

The rollup metric that propagates up the hierarchy:

```
if team_score > 0 and own_total_items > 0:
    combined = (own_score + team_score) / 2
elif team_score > 0:
    combined = team_score           # Manager with no own tasks
else:
    combined = own_score            # Individual contributor
```

### 5. Bottom-Up Propagation

```
Level 1 (Operator):     combined = own_score (no reports)
                              ↓
Level 2 (Supervisor):   combined = (own + team) / 2
                              ↓
Level 3 (Area Manager): combined = (own + team) / 2
                              ↓
Level 4 (Executive):    combined = (own + team) / 2
```

Every manager inherits their team's performance.

### 6. Score Snapshots

Calculated hourly and cached:

```python
# Score Snapshot DocType
{
  "employee": "PLS-EMP-0001",
  "period_type": "Day",          # Day/Week/Month
  "period_key": "2026-03-25",    # Date or date range
  "own_score": 0.85,
  "team_score": 0.78,
  "combined_score": 0.82,
  "total_items": 45,
  "completed_items": 38,
  "computed_at": "2026-03-25T14:00:00Z"
}
```

**Why cache?** Insights queries aggregate thousands of runs. Live calculation would be too slow.

### 7. Score Brackets

For visualization and filtering:

| Bracket | Range | Color |
|---------|-------|-------|
| Exceptional | ≥ 90% | Green |
| Strong | 80-89% | Green/Amber |
| Moderate | 60-79% | Amber |
| At Risk | 40-59% | Red/Amber |
| Critical | < 40% | Red |

## Extension Points

### Custom Score Weighting

Modify `pulse/api/scores.py:_calculate_score_snapshot()`:

```python
# Current: simple item count weighting
# Could add: template priority, item type weighting, time decay
def _calculate_score_snapshot(employee, date, period_type):
    runs = get_runs(employee, date)
    weighted_sum = sum(r.score * r.weight for r in runs)
    total_weight = sum(r.weight for r in runs)
    return weighted_sum / total_weight if total_weight else 0
```

### New Period Types

Add to `Score Snapshot` period_type options:
1. Add to DocType Select field
2. Update `cache_score_snapshots()` to generate
3. Update frontend period selector
4. Consider key format (e.g., "Q1-2026" for quarters)

### Real-Time Score Updates

Current: Hourly batch caching.
For real-time: 
1. Hook into `SOP Run` status changes
2. Trigger recalculation for affected employees
3. Use WebSocket to push to connected clients

## Dependencies

- **SOP Run** — Source data for calculations
- **Pulse Employee** — Hierarchy for rollup
- **Score Snapshot** — Caching layer

## Gotchas

1. **Team Score Edge Case:** If all direct reports have 0 combined_score (new hires, no runs), team_score becomes 0, not null. This can drag down manager scores unfairly.

2. **Period Boundaries:** Day = calendar day. Week = Monday-Sunday. Month = calendar month. No custom fiscal periods yet.

3. **Snapshot Staleness:** Snapshots are point-in-time. If you backdate a run completion, the snapshot won't auto-update until next hourly run.

4. **Floating Point:** Scores are stored as 0-1 floats. Display as percentages (×100). Rounding happens at display layer.

5. **Circular Reports-To:** Will cause infinite recursion in score rollup. The system assumes a clean hierarchy tree.

6. **Weight Inconsistency:** Runs are weighted by `total_items`, but items have their own `weight` field that's currently ignored in aggregation.
