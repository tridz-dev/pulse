# Generic Evaluation Template Design

Status: design specification for S6-T01 implementation

This document specifies the domain model, entity definitions, and structural contracts for Pulse's evaluation system. Evaluations are independent from the compliance gauge and use neutral, generic templates suited to any structured quality-like check—not only "quality control" as a departmental concept.

## 1. Rationale

The Pulse compliance gauge answers a single question: **was the assigned work completed on time?** This is a binary, time-bound execution fact about SOP runs.

Evaluations answer a different class of questions: **what was the quality, outcome, or result of the work performed?** These outcomes are independent from compliance and do not alter the compliance score. An SOP can achieve 100% compliance while its evaluation fails, and vice versa.

The design uses generic, neutral naming so that the same template engine supports:
- Quality checks (pH level, sterility verification, finish inspection)
- Safety inspections (equipment condition, hazard identification, safety protocols)
- Surveys and feedback (customer satisfaction, employee engagement, task difficulty)
- Compliance audit trails (approval sign-offs, evidence collection, required documentation)
- Environmental monitoring (temperature, humidity, cleanliness readings)

By removing "quality" from the product boundary language, the system generalizes to any organisation-defined structured assessment that should be tracked independently from on-time execution.

## 2. Canonical glossary additions

Extend [`CONTEXT.md`](../CONTEXT.md) with the following terms. These definitions are additive and do not contradict the existing glossary:

| Term | Definition |
| --- | --- |
| **Evaluation Template** | A versioned definition of a structured assessment with named fields, result types, and optional scoring policies. Templates are independent from SOP templates but may be linked to an SOP assignment for gate enforcement. |
| **Evaluation Run** | One occurrence of an evaluation template assessment, linked to an SOP run or standalone. Captures the submission timestamp, result values, evidence references, and approver trail. |
| **Result** | The recorded value(s) for one or more fields in an evaluation submission. Result type determines the data shape: boolean (pass/fail), categorical (select), numeric (integer/decimal), ratio (percentage 0–100), bounded comparison (threshold), narrative (text), or binary (file). |
| **Evaluation Result** | The aggregate outcome summary of an evaluation run, composed of individual field results. Never feeds into or affects the compliance score. Remains independently queryable and reportable. |
| **Evidence** | A structured data attachment or external reference included in an evaluation run to support a result or provide proof of assessment. May include file uploads, timestamps, observer notes, or links to external records. |

## 3. Design constraints and invariants

### 3.1. Compliance-evaluation separation (core invariant)

**Rule:** An Evaluation Result never contributes to, alters, or influences a Compliance score or percentage.

**Justification:**
- Compliance answers a time-bound operational question: did the work happen by the deadline?
- Evaluation answers a quality or outcome question: was the work done well, safely, or correctly?
- These are orthogonal dimensions. Mixing them creates ambiguous reporting and prevents independent governance.
- A failed evaluation on a timely-completed run remains a real problem, but it does not reduce the compliance score retroactively.
- Similarly, an evaluation pass on a late-completed run does not improve a compliance failure.

**Proof of separation in data:**
- Compliance scoring uses only `SOP Run` state: `completed_at` vs. `due_at` (see [06-domain-contracts.md](06-domain-contracts.md), section 4).
- Evaluation scoring reads only `Evaluation Run` fields and linked template definitions.
- No calculation or API response combines compliance and evaluation into a single percentage or gauge.
- Analytics, dashboards, and manager views may display both dimensions side-by-side, but never merged into one score.

### 3.2. No combined score

**Rejected approach:** A combined compliance-plus-evaluation score (e.g., "overall health").

**Why it is rejected:**
- Compliance and evaluation answer different governing questions for different audiences.
- Combining them requires an arbitrary weight (60% compliance + 40% evaluation?) or a complex rule engine.
- A manager responsible for execution urgency needs the compliance gauge independent from outcome quality.
- An auditor reviewing safety or quality outcomes needs evaluation independent from schedule adherence.
- Once combined, separating them again for reporting or troubleshooting becomes difficult.

**Outcome:** Pulse displays compliance and evaluation as separate visual elements, independent facts, and separate drill paths in analytics. No score computed from both dimensions exists in the product.

## 4. Core entities and fields

### 4.1. Evaluation Template

A reusable definition that specifies what should be assessed and how.

**Purpose:** Define the structure, field names, result types, and optional scoring rules for one assessment.

**Key fields:**

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `name` | Link (auto) | Primary key | Unique immutable identifier |
| `title` | String | Required | Human-readable name (e.g., "Daily Temperature Log") |
| `description` | Text | Optional | Guidance on when and how to use this template |
| `version_marker` | DateTime | Readonly | Timestamp of last significant change; frozen on evaluation run at generation |
| `fields` | Table | Min 1 required | List of assessment fields (see 4.1.1 below) |
| `scoring_model` | Select | Optional | `none` (default), `all_pass`, `threshold_count`, or custom policy name |
| `passing_threshold` | Int | Conditional | For threshold models: minimum pass count required (e.g., 8 of 10 checks must pass) |
| `is_active` | Check | Default true | Versioning: new runs use active templates only |

**Versioning and immutability:**
- Template changes do not retroactively affect existing evaluation runs.
- At the moment an Evaluation Run is generated, the effective template definition, field list, and scoring policy are frozen in the run snapshot (parallel to SOP Run snapshot contract in [06-domain-contracts.md](06-domain-contracts.md), section 7).

#### 4.1.1. Field rows (child table)

Each row in the `fields` table defines one assessment question or measurement point.

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `field_name` | String | Required, unique within template | API name and display label (e.g., `water_temperature`, `supervisor_approval`) |
| `field_label` | String | Required | Human-readable prompt (e.g., "Water Temperature Reading") |
| `field_type` | Select | Required | One of: `pass_fail`, `select`, `numeric`, `percentage`, `threshold`, `text`, `file` |
| `is_required` | Check | Default true | Submission cannot complete without a value |
| `description` | Text | Optional | Extended guidance or example for the assessor |
| `default_value` | String | Optional | Pre-filled value if applicable |
| `select_options` | Text | Conditional | For `select` type: newline-separated or JSON list of choices |
| `numeric_min`, `numeric_max` | Decimal | Conditional | For `numeric` type: valid range bounds (optional) |
| `threshold_value` | Decimal | Conditional | For `threshold` type: the pass/fail boundary (e.g., 37.5°C) |
| `threshold_operator` | Select | Conditional | For `threshold` type: `>=`, `>`, `<=`, `<`, `==` |
| `file_types_allowed` | String | Conditional | For `file` type: comma-separated MIME types or file extensions (optional) |
| `file_max_size_mb` | Int | Conditional | For `file` type: upload size limit (optional, defaults to 10) |

### 4.2. Evaluation Run

One completed or in-progress assessment occurrence, linked to an SOP run or standalone.

**Purpose:** Record the assessor's responses, timestamps, evidence, and outcome for a specific evaluation event.

**Key fields:**

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `name` | Link (auto) | Primary key | Globally unique identifier |
| `evaluation_template` | Link | Required | Reference to the template definition |
| `sop_run` | Link | Optional | If linked to an SOP run; null if standalone assessment |
| `status` | Select | Default "Open" | `Open` / `In Progress` / `Submitted` / `Approved` |
| `submission_timestamp` | DateTime | Readonly | Recorded at final submission; immutable |
| `submitted_by` | Link (User) | Readonly | Person who submitted the evaluation |
| `approved_by` | Link (User) | Optional | Approver if gate approval is required |
| `approval_timestamp` | DateTime | Optional | When approval was granted |
| `results` | Table | Populated on submission | Child rows for each template field result |
| `evaluation_snapshot` | JSON | Readonly | Frozen template definition, field list, and policy at submission time (parallel to SOP Run snapshot) |
| `remarks` | Text | Optional | Narrative summary or additional context |
| `is_gate_satisfied` | Check | Readonly | Derived: true if evaluation pass result meets any linked gate's requirements |

#### 4.2.1. Result rows (child table)

One row per template field. Populated when evaluation is submitted.

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `field_name` | String | Reference | Copied from template field definition |
| `field_type` | String | Reference | Copied from template for result interpretation |
| `submitted_value` | String or JSON | Varies | The raw submitted value (see 5.1 for type-specific format) |
| `normalized_result` | String | Derived | Standardized pass/fail or score for analytical queries |
| `file_reference` | Link (File) | Conditional | For `file` type: link to stored attachment |
| `entered_at` | DateTime | Readonly | Timestamp when result was recorded |

### 4.3. Evidence

Proof or supporting documentation attached to an evaluation run or a specific field result.

**Purpose:** Enable audit trails, visual inspection (photos), and external reference links.

**Key fields:**

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `name` | Link (auto) | Primary key | Unique identifier |
| `evaluation_run` | Link | Required | Parent evaluation run |
| `field_name` | String | Optional | If evidence is tied to a specific field; null if run-level |
| `evidence_type` | Select | Required | `file_upload`, `photo`, `external_link`, `observation_note` |
| `file_attachment` | Link (File) | Conditional | For `file_upload` / `photo` types |
| `external_url` | String | Conditional | For `external_link` type (e.g., invoice number, employee record) |
| `observer_notes` | Text | Conditional | For `observation_note` type: what the assessor observed |
| `recorded_at` | DateTime | Readonly | When evidence was attached |
| `recorded_by` | Link (User) | Readonly | Who recorded it |

## 5. Result type specifications

Each of the seven supported result types has a defined data shape and semantic meaning. This section specifies how each type is stored, validated, interpreted, and reported.

### 5.1. Pass/Fail

**Meaning:** A binary assertion: the assessed item either passed or did not.

**Data model:**
```
submitted_value: boolean ("Yes" | "No", or true | false in JSON)
normalized_result: "Pass" | "Fail"
```

**Validation:** Submission requires an explicit choice; no default.

**Analytical use:** Counts the number of passes and fails across a run. A single failed field does not automatically fail the entire evaluation unless the template scoring policy says so.

**Example:** "Did the supervisor approve this shipment?" → Yes (Pass) / No (Fail).

---

### 5.2. Select (Categorical)

**Meaning:** The assessor chooses from a predefined set of options.

**Data model:**
```
submitted_value: string (one of the template's select_options)
normalized_result: "Pass" if submitted_value in passing_options; else "Fail"
                   (or unchanged if no pass/fail classification applies)
```

**Validation:** Submission must be one of the template-defined options.

**Analytical use:** Counts outcomes by category. For scoring, a configurable subset of options may be marked as "passing" in the template definition.

**Example:** "Inspection result" → [Good | Fair | Poor]. Template can mark only "Good" as passing.

---

### 5.3. Numeric

**Meaning:** A measured or calculated number, optionally bounded.

**Data model:**
```
submitted_value: number (integer or decimal)
normalized_result: the value itself (no Pass/Fail unless threshold is applied)
```

**Validation:**
- Submission must be a valid number.
- If `numeric_min` and `numeric_max` are set in the template, reject out-of-range values.

**Analytical use:** Stored as-is for trending, averaging, and drill-down queries. No automatic pass/fail unless the field also has threshold enforcement.

**Example:** "Number of items inspected" → 42 (stored as 42, no pass/fail).

---

### 5.4. Percentage

**Meaning:** A ratio or completion metric, expressed as 0–100%.

**Data model:**
```
submitted_value: number (0.0 to 100.0)
normalized_result: the percentage value
```

**Validation:**
- Submission must be a number between 0 and 100 (inclusive).
- May be entered as decimal (e.g., 87.5) or whole number.

**Analytical use:** Aggregated, trended, or compared to a passing threshold. A template can define a minimum acceptable percentage.

**Example:** "Completion percentage of cleanup tasks" → 95.2%.

---

### 5.5. Threshold

**Meaning:** A measured value is compared to a boundary; result is Pass or Fail based on the comparison.

**Data model:**
```
submitted_value: number
threshold_value: number (defined in template)
threshold_operator: string ("<", ">", ">=", "<=", "==")
normalized_result: "Pass" if (value operator threshold_value); else "Fail"
```

**Validation:**
- Submission must be a valid number.
- Comparison is applied at submission and recorded in normalized_result.

**Analytical use:** Directly yields Pass/Fail outcome. Count of passes/fails across runs supports goal tracking (e.g., "temperature maintained ≥ 37°C on 95 of 100 checks").

**Example:** "Water temperature" with threshold ≥ 37.5°C. Submit 38.2 → Pass; submit 36.8 → Fail.

---

### 5.6. Text

**Meaning:** Free-form narrative, observation, or open-ended response.

**Data model:**
```
submitted_value: string (unrestricted, may be multiline)
normalized_result: the text itself (no Pass/Fail)
```

**Validation:**
- Submission accepts any text (no length limit enforced here; Frappe applies DB text-field limits).
- If required, must be non-empty.

**Analytical use:** Full-text searchable, includable in reports and drill-down views. Not automatically scored or aggregated. Human review typically required for interpretation.

**Example:** "Describe any safety hazards observed" → "Spill in aisle 3, cleaned up at 10:15 AM."

---

### 5.7. File

**Meaning:** Attachment or evidence upload (photo, document, recording, etc.).

**Data model:**
```
submitted_value: file reference (link to Frappe File entity)
file_reference: Link to attached File
file_metadata: { size_bytes, mime_type, uploaded_at, uploaded_by }
```

**Validation:**
- Submission must be a valid file upload.
- If `file_types_allowed` is defined, reject other types.
- If `file_max_size_mb` is set, reject files larger than the limit.

**Analytical use:** Evidence trails, audit attachment, drill-down viewing. File presence may be enough to satisfy a gate (e.g., "before approval, a photo of the completed work is required"). No automatic Pass/Fail; approval/gate logic determines satisfaction.

**Example:** "Attach photo of equipment condition" → [image.jpg, 2.3 MB].

---

## 6. Scoring and pass/fail logic

### 6.1. Field-level and run-level evaluation

An Evaluation Run can be evaluated at two levels:

1. **Field level:** Each field result is classified as Pass, Fail, or N/A (for numeric/text fields with no scoring rule).

2. **Run level:** The template's optional `scoring_model` determines if the entire evaluation run is deemed to pass or fail.

### 6.2. Scoring models

**Model: `none` (default)**
- No automatic overall pass/fail.
- Individual field results are recorded and queryable.
- Evaluation run status is `Submitted` regardless of field outcomes.
- Approval gates may still require manual review.

**Model: `all_pass`**
- Evaluation run passes only if all required fields are marked Pass (or have no pass/fail criterion).
- If any pass/fail field is Fail, the run is marked Fail.
- Used for gate enforcement: "all safety checks must pass before the SOP run can close."

**Model: `threshold_count`**
- Template defines `passing_threshold`: e.g., "at least 8 of 10 checks must pass."
- Count of Pass-result fields is compared to the threshold.
- Run passes if count ≥ threshold; else fails.
- Used for audits: "at least 80% of quality criteria met" → 80 out of 100 checks pass.

**Model: custom (extensible)**
- Later tasks may add org-defined scoring policies (weighted by criticality, conditional rules, etc.).
- Stored as a policy reference, not inline calculation.

### 6.3. Evaluation Result (aggregate outcome)

The `evaluation_result` field on an Evaluation Run is a summary derived from the scoring model and field results:

```
evaluation_result: "Pass" | "Fail" | "Needs Review" | "Incomplete"
```

**Semantics:**
- `Pass`: Run met all scoring criteria (or no scoring criteria apply and submission is complete).
- `Fail`: Run failed to meet scoring criteria.
- `Needs Review`: A gate requires manual approval; status is pending reviewer action.
- `Incomplete`: Submission is not yet finalized (status is `Open` or `In Progress`).

**Critical rule:** This result is immutable once recorded and does NOT feed into the compliance score.

## 7. Linking evaluations to SOP runs and gates

### 7.1. Evaluation in the SOP workflow

An Evaluation Run may be linked to an SOP Run through the `sop_run` field. This enables:

- **One-step completion:** If the evaluation submission is the only required action to complete an SOP, a single submit action closes both the evaluation and the SOP run.
- **Gated completion:** A required evaluation can block SOP completion if its result is Fail or if approval is not yet granted.
- **Independent tracking:** An evaluation linked to an SOP run can be resubmitted or amended without reopening the SOP run.

### 7.2. Gates

A **Gate** is a requirement that an evaluation must be passed or approved before an SOP run can transition to a desired state (e.g., completion, escalation).

**Gate entity (future S6 task):**

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `template_link` | Link (SOP Template or Assignment) | Required | Which SOP(s) require this evaluation |
| `evaluation_template` | Link (Evaluation Template) | Required | Which evaluation must be satisfied |
| `required_result` | Select | Required | `Pass` or `Submitted` (approval suffices) |
| `blocks_completion` | Check | Default true | If not satisfied, SOP run cannot be marked complete |

When an SOP run with a blocking gate is submitted:
- The system checks all linked gates.
- If any gate's evaluation has not passed (or received approval), the run remains `In Progress` with a message pointing to the unsatisfied gate.
- Once all gates are satisfied, normal completion proceeds.

**Example:** A daily safety inspection must be passed before a shift-end SOP run can be marked complete.

### 7.3. Evaluations without SOP runs (standalone)

Evaluations can also be submitted independent of any SOP:
- No `sop_run` link.
- Useful for scheduled or ad-hoc assessments (e.g., "monthly equipment audit," "customer feedback survey").
- Results are queryable, trended, and reportable on their own.

## 8. Addressing the genericity requirement

### 8.1. Why this design is not "quality-only"

The term "Evaluation Template" and "Evaluation Run" do not reference quality, inspection, or any domain-specific function. The neutral naming and generic result types deliberately support any structured assessment:

1. **Quality-control check:** "Batch pH level ≥ 6.8" (threshold result type).
2. **Safety inspection:** "All equipment guards in place" (pass/fail result type).
3. **Employee survey:** "How satisfied are you with tools?" → [Very Dissatisfied | Dissatisfied | Neutral | Satisfied | Very Satisfied] (select result type).
4. **Evidence review:** "Compliance officer approval" → file upload and approver name (file + approval gate).
5. **Temperature monitoring:** "Record ambient temperature" (numeric result type).

None of these interpretations requires different templates, field types, or scoring models. The same `Evaluation Template` and `Evaluation Run` entities serve all use cases.

### 8.2. Proof: reusable across domains

| Assessment type | Primary result types used | Scoring model | Notes |
| --- | --- | --- | --- |
| Quality control (batch testing) | Threshold, numeric, pass/fail | `all_pass` or `threshold_count` | Pass/fail criteria are domain-independent |
| Safety inspection | Pass/fail, select, file | `all_pass` | Gate can block operation if any safety check fails |
| Environmental monitoring | Numeric, threshold, percentage | `none` (trending only) | Results trended for SPC analysis; no pass/fail required |
| Customer satisfaction survey | Select, text, numeric | `none` (analysis by form response) | Responses are data, not pass/fail |
| Compliance audit | File, text, select, approval | Custom gate + `Submitted` scoring | Audit sign-off is an approval gate, not a score |

Each row re-uses the same Frappe DocTypes (Evaluation Template, Evaluation Run, Field definitions). No domain-specific terminology or DocType is needed.

## 9. Analytics and reporting contract

### 9.1. Evaluation queries (not compliance queries)

Evaluation Run queries are separate from SOP Run and compliance queries (per [06-domain-contracts.md](06-domain-contracts.md)):

**Analytics scope (non-exhaustive examples):**
- Trend of evaluation pass/fail rate over time.
- Count of submitted evaluations by template.
- Average numeric or percentage result value for a field.
- Approval turnaround time.
- Evaluations submitted but not yet linked to a closed SOP run (potential process gaps).
- Drill-down: all evaluations for one SOP run, or all runs of one template.

**Compliance queries remain unchanged:**
- Compliance score (passed runs / eligible runs) — evaluations do not alter this.
- SOP run status and lifecycle — independent from evaluation submission.
- Hierarchy roll-up of compliance — evaluations are not summed or aggregated into the gauge.

### 9.2. Dashboard separation

Manager and operator dashboards display compliance and evaluation as separate sections:
- **Compliance section:** Current gauge, trend, failed runs, hierarchy drill-down.
- **Evaluation section:** Recent submissions, pass rate by template, approval queue, evidence gaps.

No single "overall health" gauge combines the two dimensions.

## 10. Rejected alternatives

### 10.1. Combined compliance-plus-evaluation score

**Alternative:** "Overall health = (compliance_score × 0.6) + (evaluation_score × 0.4)."

**Why rejected:**
- It assumes evaluation pass/fail rate and compliance completion rate are commensurable (they are not—one is outcome quality, the other is execution timeliness).
- An arbitrary weight (60/40) is never justified across all use cases.
- It forces every evaluation template to produce a pass/fail outcome, which prevents adoption of numeric or survey-based assessments that do not have a clear pass/fail.
- Separating them again later for reporting becomes difficult once combined.

**Outcome:** Pulse displays compliance and evaluation side-by-side but never merges them into one number.

### 10.2. Evaluation as a partial compliance score

**Alternative:** "If evaluation fails, compliance score becomes 0.5 instead of 1.0 for that run."

**Why rejected:**
- It conflates two independent dimensions: execution timeliness and outcome quality.
- A manager responsible for on-time execution (SOP compliance) cannot see their true schedule performance if evaluation failures are baked into the compliance score.
- A quality auditor cannot tell if a compliance failure is a schedule issue or a quality issue.
- Once mixed, the compliance score no longer answers the single question: "Did the work happen on time?"

**Outcome:** Compliance scoring remains binary and schedule-based. Evaluation outcomes are tracked independently.

## 11. Data model sketch

This section outlines the Frappe DocTypes and child tables. Implementation tasks will convert these to formal schema.

### Entities

1. **Evaluation Template** (DocType)
   - name, title, description, version_marker, is_active
   - Child table: **Evaluation Template Fields**
     - field_name, field_label, field_type, is_required, default_value, validate rules (min/max, select_options, threshold, file constraints)
   - scoring_model, passing_threshold

2. **Evaluation Run** (DocType)
   - name, evaluation_template (link), sop_run (link, optional), status, submission_timestamp, submitted_by, approved_by, approval_timestamp
   - Child table: **Evaluation Result**
     - field_name, field_type, submitted_value, normalized_result, file_reference, entered_at
   - evaluation_snapshot (JSON), remarks, is_gate_satisfied

3. **Evidence** (DocType)
   - name, evaluation_run (link), field_name (optional), evidence_type, file_attachment (link, conditional), external_url (conditional), observer_notes (conditional), recorded_at, recorded_by

### Indexes and queries

- Evaluation Run: index on (evaluation_template, submission_timestamp) for analytics queries.
- Evaluation Run: index on (sop_run) for gate enforcement.
- Evaluation Result: queryable by field_name and normalized_result for trending.
- Evidence: queryable by evaluation_run and evidence_type for audit trails.

## 12. Example: Daily quality checklist

To illustrate, here is a concrete evaluation template definition:

**Template name:** "Daily Production Quality Check"

**Fields:**
1. `batch_id` (text): "Batch or lot number" — required
2. `ph_level` (threshold): "pH must be ≥ 6.8" — threshold_value=6.8, threshold_operator=">=", required
3. `visual_inspection` (pass/fail): "Visual inspection passed" — required
4. `temperature` (numeric): "Record ambient temperature (°C)" — numeric_min=15, numeric_max=30, not required
5. `inspector_notes` (text): "Any observations or exceptions" — optional
6. `photo_evidence` (file): "Attach photo of inspection result" — file_types_allowed="image/jpeg,image/png", file_max_size_mb=5, optional

**Scoring model:** `all_pass` (all required pass/fail fields must pass).

**Linked to SOP:** "Daily Production Shift" via a Gate that requires this evaluation to pass before shift-end SOP can close.

**Workflow:**
1. Operator generates a daily production run at 8:00 AM.
2. Operator submits the run by 4:00 PM with work log and checklist.
3. System checks the gate: "Is today's quality evaluation submitted and passed?"
4. If no: run remains in-progress, operator is prompted to complete the quality check.
5. If yes: run is marked complete, compliance score is updated (either passed or failed based on time), and evaluation results are archived.
6. Nightly job trends the quality pass rate, alerts if pH failures exceed a threshold, and updates the quality section of the manager's dashboard.

The same `Evaluation Template` machinery serves pH readings (numeric), pass/fail assertions (visual inspection), photo evidence (file), and operator notes (text). No "quality module" is named in the code or UI; it is simply "Evaluations."

## 13. Conclusion

This design establishes a generic, neutral evaluation framework that Pulse organizations can use for any structured quality-like check. The seven result types cover quantitative, qualitative, approval, and evidence scenarios. The separation of compliance and evaluation at the domain boundary ensures that SOP execution timeliness remains independently measurable and reportable, and that evaluations of work quality, safety, or outcomes remain a parallel, independent dimension. No combined score exists; no evaluation outcome alters a compliance percentage.

Implementation will follow the existing Frappe patterns in Pulse and mirror the frozen compliance contract in its immutability, snapshotting, and auditability guarantees.

## 14. Required gate contract and blocking behavior

### 14.1. Gate definition and entity

A **Gate** is a rule that requires an evaluation to be satisfied (either passed, submitted, or approved) before an SOP run can transition to completion or another gated state. Gates are the operational mechanism that enforces the policy "this SOP cannot close until this evaluation is done and acceptable."

**Gate entity:**

| Field | Type | Rule | Notes |
| --- | --- | --- | --- |
| `name` | Link (auto) | Primary key | Unique immutable identifier (e.g., "GATE-PROD-SAFETY-001") |
| `sop_template` | Link (SOP Template) | Required | Which SOP template(s) require this gate; multiple gates can apply to one SOP |
| `evaluation_template` | Link (Evaluation Template) | Required | Which evaluation template must be satisfied |
| `gate_name` | String | Required | Human-readable label (e.g., "Daily Safety Inspection") |
| `gate_description` | Text | Optional | Guidance on the gate's purpose and typical flow |
| `required_result` | Select | Required | `Pass` (evaluation must pass scoring rules) \| `Submitted` (any completed submission without failure) \| `Approved` (submission plus approver sign-off) |
| `blocks_completion` | Check | Default true | If true, gate failure prevents SOP run completion; if false, gate is advisory only |
| `approval_role` | Link (Role) | Conditional | If `required_result` is "Approved", which role can approve this gate |
| `escalate_on_overdue` | Check | Default false | If true, if gate remains unsatisfied after SOP due_at, system may escalate (e.g., notify manager) |
| `is_active` | Check | Default true | Inactive gates do not block new SOP runs |

### 14.2. Gate status model

An Evaluation Run linked to a Gate transitions through the following states as it progresses:

**Gate status values (derived from Evaluation Run state and result):**

| Status | Definition | Transition trigger | Can block completion? |
| --- | --- | --- | --- |
| `Not Required` | No gate applies to this SOP run (e.g., SOP template has no gates, or gate is inactive) | During SOP run creation if no active gates exist | No |
| `Pending` | Gate exists but no evaluation has been submitted yet | SOP run created and linked to a gate; no Evaluation Run exists | Yes, if blocks_completion=true |
| `In Review` | Evaluation has been submitted but is awaiting approval (status "Submitted", requires Approved gate) | Evaluation Run submitted and marked "Submitted"; gate requires_result="Approved" | Yes, if blocks_completion=true |
| `Satisfied` | Evaluation result meets the gate's required_result criterion (Pass, Submitted, or Approved as specified) | Evaluation Run result matches gate policy (result="Pass" or "Submitted" or "Approved" state is set) | No |
| `Unsatisfied` | Evaluation has been submitted but result failed to meet gate policy (e.g., evaluation result="Fail" but gate requires "Pass") | Evaluation Run computed result = "Fail" or "Needs Review" despite submission | Yes, if blocks_completion=true |
| `Overdue` | Gate was Pending or In Review at SOP due_at time (SOP missed its deadline while gate was still outstanding) | SOP due_at timestamp passes while gate is in Pending or In Review state | Yes (always blocks); may trigger escalation |

**Gate status is always derived**, never stored as a separate field. The system computes it at query time from:
- Existence and active status of the linked gate definition
- Linked Evaluation Run status and evaluation_result fields
- SOP Run due_at and current time

### 14.3. Blocking behavior on SOP completion

When an SOP run user (operator or supervisor) attempts to complete an SOP run, the system performs gate validation before allowing the transition.

**Blocking check (pseudocode, slotted into complete_run guard clauses):**

```
function complete_run(run_name):
    # ... existing guards (access, compliance_result, status, evidence) ...
    
    # NEW: Gate validation
    run = fetch SOP Run (run_name)
    gates = fetch all Gate records where sop_template = run.sop_template and is_active = true
    
    for each gate in gates:
        if gate.blocks_completion == false:
            continue  # This gate is advisory; do not block
        
        evaluation_run = fetch Evaluation Run where sop_run = run_name and evaluation_template = gate.evaluation_template
        
        if evaluation_run == null:
            gate_status = "Pending"
        else if evaluation_run.status == "Submitted":
            if gate.required_result == "Pass" and evaluation_run.evaluation_result != "Pass":
                gate_status = "Unsatisfied"
            else if gate.required_result == "Approved" and evaluation_run.approval_timestamp == null:
                gate_status = "In Review"
            else:
                gate_status = "Satisfied"
        else:
            gate_status = "Unsatisfied"
        
        if gate_status in ("Pending", "In Review", "Unsatisfied", "Overdue"):
            frappe.throw(
                f"Cannot complete run: required gate '{gate.gate_name}' is {gate_status}. "
                f"{gate.gate_description or 'Complete the linked evaluation before run closure.'}"
            )
    
    # ... proceed with completion ...
```

**Error messages (consistent with existing guard-clause style):**

- **Gate Pending:** `"Cannot complete run: required gate 'Daily Safety Inspection' is Pending. Submit the evaluation before closing the SOP."`
- **Gate In Review:** `"Cannot complete run: required gate 'Supervisor Approval' is In Review. Await approver sign-off before closing the SOP."`
- **Gate Unsatisfied:** `"Cannot complete run: required gate 'Quality pH Check' is Unsatisfied. Evaluation failed; retake the assessment or request waiver from Quality team."`
- **Gate Overdue:** `"Cannot complete run: required gate 'Daily Safety Inspection' is Overdue. SOP passed due time while gate was pending; escalation may be triggered."`

### 14.4. Frappe Workflow integration for maker-checker gates

Frappe Workflow is the framework's native state-machine feature for managing multi-step approval workflows with permissioned transitions. For gates requiring an approval step (gate.required_result = "Approved"), the gate status "In Review" maps onto a Workflow state as follows:

**Workflow-gate binding:**

1. **Gate definition:** `required_result = "Approved"` signals that the evaluation must receive explicit approver sign-off.
   
2. **Evaluation Run Workflow state:** Attach a Frappe Workflow to the Evaluation Run DocType with the following state machine:
   ```
   States:
   - "Open" (initial)
   - "Submitted" (evaluation has been filled and submitted)
   - "Awaiting Approval" (submitted, awaiting approver; gate status = "In Review")
   - "Approved" (approver granted sign-off; gate status = "Satisfied")
   - "Rejected" (approver denied; gate status = "Unsatisfied")
   
   Transitions:
   - Open → Submitted (anyone with Evaluation Run Create permission)
   - Submitted → Awaiting Approval (auto-trigger when evaluation is submitted and required_result="Approved")
   - Awaiting Approval → Approved (users with approval_role from gate definition)
   - Awaiting Approval → Rejected (users with approval_role)
   - Rejected → Submitted (resubmit for re-review)
   ```

3. **Approver role enforcement:** The gate's `approval_role` field (e.g., "QA Manager", "Shift Supervisor") is recorded as the permissioned role for the Workflow transition. Frappe's permission model enforces that only users in that role can click the "Approve" or "Reject" buttons.

4. **Mapping gate status to Workflow state:**
   - Gate status "In Review" = Evaluation Run Workflow state "Awaiting Approval"
   - Gate status "Satisfied" (when approval required) = Evaluation Run Workflow state "Approved"
   - Gate status "Unsatisfied" (when approval required) = Evaluation Run Workflow state "Rejected"

5. **Approval timestamp:** When a Workflow transition to "Approved" occurs, the Evaluation Run's `approval_timestamp` field is set to `now()` and `approved_by` field is set to `frappe.session.user`. This immutable record serves as the audit trail.

6. **No blocking in Workflow state machine:** The Workflow manages approver-side permissions and state transitions. Gate validation (section 14.3) is a separate, SOP-completion-side check that reads the Evaluation Run's approval state to determine if a gate is satisfied. The Workflow does not directly block SOP completion; rather, it enforces that an evaluation cannot reach "Approved" state without the right approver, and the gate blocking check enforces that SOP completion cannot proceed until all required gates are satisfied.

**Conceptual flow for an approval gate:**

1. Operator submits SOP run with linked evaluation template that requires approval.
2. Operator also completes and submits the Evaluation Run.
3. Evaluation Run status becomes "Submitted" and Workflow state becomes "Awaiting Approval."
4. Operator then attempts `complete_run()` on the SOP.
5. Gate validation sees `gate.required_result = "Approved"` but `approval_timestamp = null`, so gate status = "In Review."
6. `frappe.throw()` blocks completion with message: "Cannot complete run: required gate 'Supervisor Approval' is In Review. Await approver sign-off."
7. A user with `approval_role` (e.g., Shift Supervisor) reviews the Evaluation Run in Frappe UI.
8. Supervisor clicks "Approve" button, which Workflow transitions state to "Approved" and sets approval_timestamp and approved_by.
9. Same operator (or different user) calls `complete_run()` again.
10. Gate validation sees `approval_timestamp != null`, so gate status = "Satisfied."
11. Gate blocking check passes; SOP run is marked Completed.

### 14.5. Gate interaction with evaluation result scoring

**Important:** Gates and evaluation result scoring (section 6) are independent:

- A gate can require result = "Pass" even if the evaluation template has `scoring_model = "none"` (no automatic scoring). In this case, the evaluation's `evaluation_result` is derived from manual review or approver determination, not automatic calculation.

- Conversely, an evaluation template can have `scoring_model = "all_pass"` (automatic pass/fail calculation), but a gate linked to that template can require result = "Submitted" (any submission is sufficient, regardless of auto-computed result).

- The gate's `required_result` field (Pass, Submitted, Approved) is the enforcement criterion. It does not alter how the evaluation template scores itself; it only determines what threshold the SOP completion gate checks.

### 14.6. Advisory gates and waiver workflows

If a gate is defined with `blocks_completion = false`, it is **advisory**: the gate check will not prevent SOP completion even if unsatisfied. This supports organizational workflows where:

- An evaluation is encouraged or tracked but not mandatory (e.g., "customer feedback is appreciated but does not block SOP closure").
- A waiver process exists outside the gate mechanism (handled by a separate approval DocType or manual sign-off).

Advisory gates still appear in gate status queries and dashboards, allowing managers to monitor and report on unsatisfied but non-blocking evaluations. The SOP completion guard clause (section 14.3) simply skips advisory gates during validation.

### 14.7. Audit trail and immutability

Once an SOP run is marked Completed:
- All linked Evaluation Runs become immutable (no further submissions or approvals).
- The gate status snapshot at completion time is recorded (for future compliance audits and drill-down).
- If re-assignment or dispute arises, the audit trail shows evaluation submission time, approver name, approval timestamp, and SOP completion time, all timestamped and recorded by Frappe's default user tracking.

## 15. One-step linked completion

### 15.1. Design overview

A **one-step linked completion** workflow is an optimization for SOP runs where submitting or approving a linked evaluation is the only required action to close the SOP run. In this scenario, the user takes a single action (submit/approve the evaluation) and the SOP run automatically completes without a separate "Complete Run" step.

This design removes duplicate submission and approval steps while preserving:
- The existing deadline-based Pass/Fail logic from section 1 (SOP passes if completed by due_at).
- The existing gate model and blocking behavior from sections 14.1–14.3.
- The existing immutability and audit trail contracts from section 14.7.

### 15.2. Configuration: qualifying for one-step completion

An SOP run is eligible for one-step automatic completion if and only if **all of the following are true:**

1. **Exactly one blocking gate is attached to the SOP template:**
   - The template has exactly one Gate record with `is_active = true` and `blocks_completion = true`.
   - All other gates (if any) have `blocks_completion = false` (advisory only).

2. **No manual completion steps required:**
   - The SOP run has no checklist items (run_items table) with `evidence_required` set to anything other than "None".
   - Equivalently: either the run has no run_items, or all run_items have `evidence_required = "None"` and no evidence_required items require explicit "Completed" status (per section 1's complete_run guard).

3. **The sole blocking gate is linked to an evaluation template:**
   - The single blocking Gate record has a valid `evaluation_template` link (see section 14.1).
   - No other gate type or blocking mechanism (e.g., manual approval, external event) is attached to this SOP.

**Example qualifying configuration:**
- SOP Template "Daily Quality Audit"
- Single Gate: "QA Sign-off" (blocks_completion=true, required_result="Approved", linked to Evaluation Template "QA Checklist")
- No evidence-required checklist items
- Result: when the QA Checklist evaluation is submitted and approved, the SOP run automatically closes.

**Example non-qualifying configuration:**
- SOP Template "Equipment Maintenance"
- Gate 1: "Safety Inspection" (blocks_completion=true, required_result="Pass")
- Gate 2: "Maintenance Log Review" (blocks_completion=true, required_result="Approved")
- Result: two blocking gates, so the SOP requires both evaluations. One-step completion does NOT apply; user must explicitly click "Complete" after both gates are satisfied.

### 15.3. Trigger mechanism: automatic completion on gate satisfaction

When an SOP run qualifies for one-step completion (per section 15.2), the system automatically invokes the completion logic as soon as the sole blocking gate transitions to `Satisfied` state (per section 14.2).

#### 15.3.1. Trigger point and causality

**Trigger point:** The moment an Evaluation Run linked to the sole blocking gate transitions to a state where its gate status becomes `Satisfied`.

**Gate status = Satisfied occurs when:**
- `gate.required_result = "Pass"` and `evaluation_run.evaluation_result = "Pass"` (evaluation result matches scoring policy).
- OR `gate.required_result = "Submitted"` and `evaluation_run.status = "Submitted"` (any submission is sufficient, regardless of pass/fail).
- OR `gate.required_result = "Approved"` and `evaluation_run.approval_timestamp != null` (approver has signed off).

**Action on trigger:** The system asynchronously or synchronously invokes the same completion logic as the manual `complete_run()` API call (defined in pulse/api/tasks.py, section 1), using the same state transitions and guard clauses. Specifically:

1. Set `SOP Run.status = "Completed"`.
2. Set `SOP Run.completed_at = now()`.
3. Determine `SOP Run.compliance_result` by comparing `completed_at` to `due_at` (Pass if `completed_at <= due_at`, Fail otherwise).
4. Lock the SOP Run for immutability (section 14.7).

**Idempotence and race safety:**
- If the SOP run is already Completed when the gate becomes Satisfied, the automatic completion is a no-op (the run is already in terminal state).
- The row-lock mechanism from complete_run (see pulse/api/tasks.py docstring) ensures that automatic completion and deadline-based finalization (finalize_overdue_runs) do not race. Whichever transaction acquires the lock first completes the run; the other sees the run already in terminal state and commits without further action.

#### 15.3.2. Call site: where the trigger is executed

The trigger must be wired into the Evaluation Run submission/approval flow. Specifically:

1. **After Evaluation Run status → "Submitted"** (line 123 in a future Evaluation Run submission method):
   - Compute the Evaluation Run's `evaluation_result` using its template's scoring model (section 6.2).
   - If the Evaluation Run has a linked `sop_run`, check if the SOP template qualifies for one-step completion (section 15.2).
   - If qualified, compute the gate status for the linked gate. If gate status = "Satisfied" and `gate.required_result != "Approved"`, invoke completion.

2. **After Evaluation Run status → "Approved"** (Workflow transition, section 14.4):
   - If `gate.required_result = "Approved"`, check if the SOP qualifies for one-step completion and if gate status = "Satisfied", invoke completion.

**Implementation note:** The actual completion logic should be extracted into a helper function (e.g., `_maybe_auto_complete_linked_sop_run(evaluation_run, gate)`) to avoid duplication between the manual `complete_run()` endpoint and the automatic trigger. The helper encapsulates the core completion steps (set status, set completed_at, compute compliance_result) and is called from both paths.

### 15.4. Failure behavior: incomplete or failed evaluations

#### 15.4.1. Evaluation pending (gate status = Pending)

**State:** Evaluation Run does not yet exist or has not been submitted.

**SOP Run state:** Remains `In Progress`. No automatic action occurs.

**User experience:** 
- The SOP run's gate status shows "Pending" in the UI.
- The SOP run cannot be manually completed via the `complete_run()` API because the gate validation guard (section 14.3) will reject it with message: `"Cannot complete run: required gate '[gate_name]' is Pending. Submit the evaluation before closing the SOP."`
- The SOP remains in this state until:
  - The user submits the evaluation (gate transitions to "In Review" or "Satisfied"), OR
  - The due_at deadline passes (finalize_overdue_runs marks the run Failed due to the outstanding gate, per section 14.2 "Overdue").

#### 15.4.2. Evaluation submitted but failed (gate status = Unsatisfied)

**State:** Evaluation Run has been submitted with `evaluation_result = "Fail"` (or equivalent failure condition for the gate's `required_result`).

**SOP Run state:** Remains `In Progress`. No automatic completion is triggered (gate status is not Satisfied).

**User experience:**
- The SOP run's gate status shows "Unsatisfied" in the UI, with a message indicating the evaluation failed (e.g., "QA Checklist failed; retake the assessment").
- The SOP run cannot be manually completed via the `complete_run()` API; the gate validation guard will reject it with message: `"Cannot complete run: required gate '[gate_name]' is Unsatisfied. Evaluation failed; retake the assessment or request waiver from Quality team."`
- The SOP remains in this state until:
  - The user resubmits the evaluation and it passes (gate transitions to Satisfied, triggering automatic completion), OR
  - The due_at deadline passes (finalize_overdue_runs marks the run Failed due to the unsatisfied gate).

**Compliance result determination:**
- If the evaluation fails before the due_at deadline, the SOP run remains `In Progress` with no compliance_result yet.
- If the deadline arrives while the gate is Unsatisfied, the scheduled finalizer (finalize_overdue_runs) will mark the run `Completed` with `compliance_result = "Failed"` (because due_at has passed, per section 1's complete_run logic).
- **Rationale:** This preserves the existing Pass/Fail-at-deadline semantics. The evaluation failure does not immediately fail the SOP; instead, the deadline finalizer observes the unsatisfied gate and fails the run due to lateness. This gives users time to resubmit the evaluation and still achieve Passed status if they act before the deadline.

#### 15.4.3. Evaluation in review (gate status = In Review)

**State:** Evaluation Run has been submitted and is awaiting approver sign-off (gate.required_result = "Approved", per section 14.4).

**SOP Run state:** Remains `In Progress`. No automatic completion is triggered (gate status is not Satisfied).

**User experience:**
- The SOP run's gate status shows "In Review".
- The SOP run cannot be manually completed via the `complete_run()` API; the gate validation guard will reject it with message: `"Cannot complete run: required gate '[gate_name]' is In Review. Await approver sign-off before closing the SOP."`
- The SOP remains in this state until:
  - The approver approves the evaluation (gate transitions to Satisfied, triggering automatic completion), OR
  - The due_at deadline passes (finalize_overdue_runs marks the run Failed).

### 15.5. Before/after walkthrough: removing duplicate submission steps

#### 15.5.1. Before: manual completion workflow

**Scenario:** SOP Template "Daily Quality Audit" requires submission of a quality evaluation to close.

**User actions (without one-step optimization):**
1. Operator generates a daily SOP run at 7:00 AM (status = "Open").
2. Operator performs the work throughout the shift.
3. Operator accesses the SOP run detail form and clicks "Submit SOP Run" or navigates to an evaluation form.
4. Operator fills in the quality checklist (Evaluation Run form) and clicks "Submit Evaluation" (Evaluation Run status → "Submitted", gate status → "Satisfied").
5. **Duplicate step:** Operator navigates back to the SOP run detail and clicks "Complete Run" button (manual call to complete_run).
6. System marks SOP Run status → "Completed", computes compliance_result, and closes the form.

**Problem:** The operator must take two separate submission actions (step 4 and 5) even though the evaluation submission already satisfies the only requirement. The "Complete Run" button is a redundant step when there is no other completion criterion.

#### 15.5.2. After: one-step linked completion

**Same scenario with one-step optimization enabled:**

**Configuration:** SOP Template has exactly one blocking Gate linked to the quality evaluation template, no evidence-required checklist items.

**User actions (with one-step optimization):**
1. Operator generates a daily SOP run at 7:00 AM (status = "Open").
2. Operator performs the work throughout the shift.
3. Operator accesses the SOP run detail form or evaluation form.
4. Operator fills in the quality checklist (Evaluation Run form) and clicks "Submit Evaluation" (Evaluation Run status → "Submitted").
5. **System automatically triggers:** Gate status becomes "Satisfied" → system invokes completion logic → SOP Run status → "Completed", compliance_result computed.
6. Operator sees the SOP run automatically marked Completed in the UI (or sees confirmation message).

**Improvement:** The "Complete Run" button is eliminated for this case. The operator's action (submit evaluation) directly and immediately closes the SOP run. No duplicate steps, no cognitive overhead of separate submission and completion actions.

#### 15.5.3. Audit trail equivalence

Both workflows produce identical audit trails and immutable state:
- SOP Run.completed_at and SOP Run.compliance_result are determined identically (by the same completion logic).
- Evaluation Run submission timestamp, submitted_by, and approval state (if applicable) are unchanged.
- SOP Run.status = "Completed" is recorded the same way.
- Section 14.7 immutability and audit trail contracts apply identically.

The only difference is **timing**: in the before scenario, completed_at is set when the user clicks "Complete Run"; in the after scenario, it is set automatically when the evaluation becomes Satisfied. Both timestamps are recorded in the audit trail and are equally valid for compliance reporting.

### 15.6. Interaction with deadline-based finalization

The one-step completion mechanism does not alter the existing finalize_overdue_runs scheduler (pulse/tasks.py, scheduled nightly):

- If an evaluation is submitted and passes before due_at, one-step completion fires immediately, marking the SOP Completed with Passed status.
- If an evaluation is still pending or failed at due_at time, the finalizer observes the gate as not Satisfied and marks the SOP Completed with Failed status (because the deadline has passed, per section 1's Pass/Fail logic).
- If multiple evaluations are required (not one-step), the finalizer checks all gates; if any are unsatisfied at deadline, the run is Failed.

**Concurrency:** Both the one-step trigger (Evaluation Run submission) and the deadline finalizer (scheduled task) can attempt to complete the SOP run. The row-lock mechanism in complete_run (pulse/api/tasks.py) ensures that whichever transaction acquires the lock first wins; the second transaction sees the run already Completed and becomes a no-op. No race condition or duplicate state transition can occur.

### 15.7. When one-step does not apply: explicit completion still required

If an SOP template does NOT qualify for one-step completion (section 15.2):
- Multiple blocking gates exist, OR
- Evidence-required checklist items exist, OR
- Blocking gate is not linked to an evaluation

Then the user **must explicitly call complete_run()** to close the SOP run, even after all gates are satisfied. The system will not automatically complete the run. This ensures that multi-requirement workflows remain explicit and do not hide incompleteness behind automatic transitions.

**Example:** A maintenance SOP with two required gates (equipment safety inspection + supervisor approval) does not auto-complete when the first gate is satisfied. The user must verify all gates are satisfied before clicking "Complete Run" to finalize the SOP.
