# Clinical Reasoning Engine — Product Spec & Session Handoff

**Healthcare AI Hackathon · University of Toronto · March 2026**
**Last updated: 2026-03-09**

---

## 1. Product Vision

**One-liner:**

> AI-powered coordination layer that keeps the doctor and nurse in sync — silently, at 3 AM, without a single phone call.

**What it is:**
A real-time emergency room triage queue system where AI automatically scores incoming patients by severity, flags drug-disease contradictions from their prior history, and enables the doctor to silently reprioritize the queue. The nurse's view updates instantly. No paging. No phone calls. No walking.

**What it is NOT:**

- Not a diagnosis tool
- Not a replacement for clinical judgment
- Not an admin or billing system

**The core narrative:**
The AI buys back time. Even if it scores a patient incorrectly, the time it saves the doctor and nurse reviewing every chart means they have the bandwidth to catch and correct those mistakes themselves. The override feature isn't a safety net — it's authentic clinical behaviour.

---

## 2. The Demo Scenario

**Setting:** 3:00 AM, emergency room, ~15–20 patients in the waiting queue.

**Demo opens with the Doctor View** ← chosen opening (more intense, higher stakes)

**Before touching the app (verbal, 10 seconds):**

> *"It's 3 AM. There are 15 people in the waiting room. Some of them are in pain. Some of them look fine but aren't. One of them has an INR of 6.9 and nobody has caught it yet."*

**App loads — Doctor View (the queue):**

- 15 patient cards, ranked by AI severity score
- The override-demo patient is sitting at **#6** — moderate score, below others
- It has a ⚠️ low-confidence flag and a contradiction badge visible on the card
- Presenter: *"The AI scored her moderate. It's not wrong — it just doesn't have enough confidence. That flag is the system saying: look closer."*

**Click into the patient — reasoning streams live:**

- Presenter: *"I click in. The AI is thinking in real time."*
- Streaming text appears: *"Warfarin is active. Checking INR... value is 6.9. Therapeutic range is 2.0–3.0. This patient is at significant bleeding risk..."*

**Drag from #6 → #1:**

- Presenter: *"I drag her to the top."*
- Override modal appears. Presenter types: *"INR 6.9 — bleeding risk, bring in immediately."*
- Hit confirm.

**Flip briefly to Nurse View (15 seconds, payoff moment):**

- Presenter: *"Here's what the nurse sees — right now."*
- Queue updated, notification badge on patient card, doctor's note visible
- Presenter: *"No pager. No phone call. She'll have this patient in my bay in 20 seconds."*

**Pause. Then:**

> *"And the system just learned. Next time it sees a patient on Warfarin with a high INR, it won't rank them sixth."*

**Total demo runtime target:** 90 seconds for this core sequence. The nurse view is supporting cast — shown after the override, not as the opener.

---

## 3. User Roles & Views

**Single shared queue, two modes.** A toggle at the top switches between Nurse Mode and Doctor Mode. No separate auth for the hackathon demo — one hardcoded persona per mode.

### Nurse Mode

**Persona:** Charge Nurse at triage desk
**Primary job:** Move patients through statuses, monitor the waiting room, respond to doctor overrides
**Actions available:**

- View full queue (all statuses)
- Click status chip to advance patient through workflow
- Drag patient card to reorder (manual urgency override)
- Add intake notes to a patient
- See doctor override notifications with reason note

### Doctor Mode

**Persona:** Dr. Chen, ER physician
**Primary job:** Manage AWAITING_DOCTOR queue, review AI analysis, see patients
**Actions available:**

- View AWAITING_DOCTOR queue ranked by AI severity score
- Click into patient → full detail view with streaming AI reasoning
- Drag to reorder queue + add override note
- View contradiction flags with action recommendations
- See prior admission history timeline

---

## 4. Patient Status Workflow

Four statuses — exactly what hospital staff live every shift.

```
WAITING → TRIAGED → WITH_DOCTOR → DONE
```

| Status        | Chip style       | Who acts    | What it means                                                           |
| ------------- | ---------------- | ----------- | ----------------------------------------------------------------------- |
| `WAITING`     | Grey outline     | Nurse       | Checked in at window. **AI fires immediately** from prior history.      |
| `TRIAGED`     | Grey filled      | AI + Doctor | Nurse assessed. AI score confirmed. Queued for doctor by severity.      |
| `WITH_DOCTOR` | Dark filled      | Doctor      | In the bay being seen.                                                  |
| `DONE`        | Muted            | Doctor      | Discharged or admitted.                                                 |

**Status chips are monochrome.** Color belongs exclusively to the AI severity badge (⬛ CRITICAL / 🔴 HIGH / 🟡 MODERATE / 🟢 LOW). No conflict.

**The key clinical distinction is WAITING → TRIAGED.** That is the moment the nurse hands clinical responsibility to the queue system. Hospital staff judges will recognize this immediately — it's the handoff they do every shift.

**Demo line for judges:**
> *"The moment a patient checks in at the window, they're in our system. The AI starts working immediately."*

The nurse types a name and chief complaint — record created, AI cross-references prior history, queue updates. The patient hasn't been triaged yet, but the system already knows something about them.

**This creates the demo tension:**
> *"This patient checked in 20 minutes ago with chest discomfort. She's sitting in the waiting room. But our system already pulled her history — Warfarin, INR 6.9 — and flagged it. The nurse hasn't gotten to her triage yet. The doctor almost missed her."*

**When AI scoring fires:**
- `WAITING`: immediate, from prior history alone (chief complaint + past labs/rx/diagnoses)
- `TRIAGED`: re-confirmed with nurse-collected vitals, score finalized

**AI outputs per patient:**
- `severityScore` (0–100)
- `confidenceScore` (0–100) — below 60 triggers ⚠️ amber flag
- `contradictions[]` array

---

## 5. AI Scoring System Design

### Two Scores Per Patient

```
severityScore   (0–100)  — how urgent is this patient RIGHT NOW
confidenceScore (0–100)  — how certain is the AI about that score
```

Queue is **sorted by severity**. Low confidence scores are **visually flagged** with ⚠️ amber warning — "AI is uncertain, please review."

### Severity Score Inputs

- ICD-9 diagnosis codes (critical codes: MI, sepsis, respiratory failure, stroke = +50)
- Drug-disease contradictions detected (+10 per contradiction, max +20)
- Critical lab values (creatinine > 3.0, K+ < 2.5 or > 6.5)
- CHF/stroke = +35, pneumonia/COPD = +20, diabetes = +10

### Confidence Score Inputs

- Data richness: lab count + (rx count × 3) + (diagnosis count × 2)
- More data = higher confidence
- Sparse data (few records) = low confidence = ⚠️ flag

### Contradiction Detection (5 rules)

1. **Metformin + Creatinine > 1.5 mg/dL** — lactic acidosis risk
2. **Metformin + active CKD diagnosis (ICD 585.x)** — contraindicated
3. **ACE inhibitor + Potassium > 5.5 mEq/L** — hyperkalemia risk
4. **Warfarin + INR > 3.5** — supratherapeutic, bleeding risk
5. **NSAID + active CKD** — worsens renal function
6. **NSAID + active CHF** — causes fluid retention

Each contradiction has a severity level (CRITICAL / HIGH / MODERATE) and a recommended action string.

---

## 6. AI Architecture

**Decision: Use Vercel AI SDK end-to-end** (not split with direct Anthropic SDK)

Vercel AI SDK fully supports:

- Extended thinking via `providerOptions.anthropic.thinking`
- Streaming with `reasoning-start`, `reasoning-delta`, `reasoning-end` events
- Tool use / function calling
- `useChat` hook for streaming UI
- Multi-model flexibility

### The Single AI Call (per patient scoring)

One `streamText` call with tool use. The agent calls tools sequentially, then synthesizes:

```
Tools:
  query_labs(hadm_id)          → returns lab results for this admission
  query_prescriptions(hadm_id) → returns active medications
  query_diagnoses(hadm_id)     → returns ICD-9 codes
  query_prior_admissions(subject_id) → returns past admission summaries

Output (structured):
  {
    severityScore: number,
    confidenceScore: number,
    contradictions: Contradiction[],
    summary: string,           // one paragraph shown on patient card
    reasoning: string,         // extended thinking — streams live in UI
    recommendedActions: string[]
  }
```

### Extended Thinking Display

The `reasoning` stream shows in a collapsible panel on the patient detail page. It streams token-by-token so judges watch the AI think in real time:

> *"Patient has Metformin prescribed. Checking creatinine... value is 1.6 mg/dL, exceeds threshold of 1.5. This is a contraindication. Flagging..."*

### Model

`claude-sonnet-4-6` with extended thinking enabled, budget: 8000–12000 tokens.

---

## 7. Real-Time Sync (Nurse ↔ Doctor)

**Problem:** When doctor reorders queue, nurse panel must update instantly without page refresh.

**Solution:** Server-Sent Events (SSE) — simple, native to Next.js, no WebSocket complexity needed for a demo.

```
GET /api/queue/stream   → SSE endpoint
  Emits: { type: 'queue_updated', patients: [...] }
  Triggers on: any status change, any reorder, any new note
```

Nurse panel polls this stream. Doctor action → DB write → SSE event → nurse panel re-renders.

**Notification:** When doctor overrides a patient rank, a notification badge appears on the nurse's view of that patient card showing the doctor's note. Dismissible.

---

## 8. RL Feedback System (Preference Learning)

**What it actually is:** Few-shot preference injection. Not real model training. No GPU. No weights.

**Mechanism:**

1. Doctor drags patient from rank N → rank M → stored as `ScoringFeedback` record
2. Doctor optionally adds a note explaining why
3. On next scoring call for any patient, system retrieves the 5 most recent relevant feedback records
4. These are injected as few-shot examples into the scoring prompt:
  > *"In a previous case: patient had Warfarin prescribed with INR 6.9. Doctor elevated priority to #1. Weight anticoagulation contradictions heavily in your severity assessment."*
5. Score updates immediately — real-time learning

**Frequency:** Real-time. Every override affects the next scoring call immediately.

**UI indicator:** "Model has refined from N doctor corrections" counter shown in the queue header. This is the visible RL story for the demo.

**Correct terminology to use in pitch:** *"Continuous preference learning"* or *"human-in-the-loop scoring refinement."* Reference: inspired by Constitutional AI (Anthropic, 2022) and Direct Preference Optimization.

**What it is NOT:** RLHF, fine-tuning, gradient descent, model training. RLinf and similar frameworks are irrelevant — they require GPU infrastructure and model weight access.

---

## 9. Patient Card Design (Queue View)

```
┌──────────────────────────────────────────────────────┐
│ 🟡 AWAITING DOCTOR          #2 in queue    [drag ⠿] │
│                                                      │
│ Margaret T.  · 71F · Arrived 02:47                  │
│ Chief complaint: Chest tightness, shortness of breath│
│                                                      │
│ Known CHF patient with prior admission for acute     │
│ decompensation. BNP significantly elevated.          │
│ Active Lasix Rx noted. [AI summary — 1 paragraph]   │
│                                                      │
│ Severity  ██████████  87     Confidence ████░░  63 ⚠️│
│ ⚡ 3 contradictions found                            │
│                                                      │
│ [View Full Profile]          [Override · Add Note]   │
└──────────────────────────────────────────────────────┘
```

**Low confidence rule:** `confidenceScore < 60` → amber card border + ⚠️ badge + auto-expanded reasoning panel hint.

---

## 10. Patient Detail Page — Information Hierarchy

When any user clicks into a patient:

1. **Header** — name, age, gender, status badge, time waiting, hadm_id
2. **AI Reasoning panel** — streaming extended thinking (collapsible, open by default)
3. **Contradiction flags** — each with severity level + recommended action
4. **Current visit** — chief complaint, nurse intake notes, vitals
5. **Active medications** — with inline contradiction flags
6. **Key lab values** — abnormal values highlighted in red/amber
7. **Prior admissions timeline** — past visits linked to `/admissions` records
8. **Notes thread** — doctor and nurse notes, with role badge

---

## 11. Override Modal

Triggered when doctor drags a patient to a new position:

```
┌─────────────────────────────────────┐
│  Override queue position            │
│                                     │
│  Moving: Margaret T. → Position #1  │
│  (AI suggested: #6)                 │
│                                     │
│  Reason (optional):                 │
│  ┌─────────────────────────────┐    │
│  │ INR 6.9 — bleeding risk,    │    │
│  │ bring in immediately        │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Cancel]         [Confirm Move]    │
└─────────────────────────────────────┘
```

On confirm:

- DB writes: `ScoringFeedback` record (original rank, adjusted rank, note, timestamp, role)
- SSE event fires → nurse panel updates instantly
- Nurse sees notification badge on patient card with the note
- RL counter increments

---

## 12. Page Structure

```
/                      → Active Queue (MAIN DEMO PAGE)
                         Shows: REGISTERED, IN_TRIAGE, AWAITING_DOCTOR, WITH_DOCTOR
/patients/[id]         → Patient Detail
/admissions            → Previous Admissions (MIMIC historical data, 2000 records)
```

The `/admissions` page is the "previous visits" archive — separate from the live queue. Patients in the live queue may have records here.

---

## 13. Dataset & Seed Data

**Source:** MIMIC Clinical Database (de-identified) — 2000 hospital admissions
**Location:** `datasets/` folder (6 .csv.gz files)

**Key data issue discovered:**
`clinical_cases.csv.gz` stores `hadm_id` as float strings (`'149568.0'`). All other tables store as integers (`'149568'`). Normalization function `normalizeId()` in `scripts/scan-dataset.ts` handles this.

**14 real MIMIC cases selected** via `scripts/scan-dataset.ts` → output in `scripts/scan-output.json`

Selected case slots:


| Slot                               | Count | Purpose                                                                          |
| ---------------------------------- | ----- | -------------------------------------------------------------------------------- |
| `drug_contradiction_metformin`     | 2     | Metformin + high creatinine (real contraindication)                              |
| `drug_contradiction_ace_inhibitor` | 1     | ACE inhibitor + K+ > 5.5                                                         |
| `high_severity_high_confidence`    | 2     | Critical ICD codes, rich data                                                    |
| `high_severity_low_confidence`     | 1     | ⚠️ flag demo — sparse data                                                       |
| `multiple_prior_admissions`        | 2     | Longitudinal history value                                                       |
| `moderate_severity`                | 3     | CHF / COPD / DM chronic conditions                                               |
| `low_severity`                     | 2     | Queue contrast — routine cases                                                   |
| `override_demo`                    | 1     | **The live demo case** — contradiction present, moderate score, doctor overrides |


**Next step:** Write `scripts/seed.ts` to load these 14 cases into the database as `QueuePatient` records.

---

## 14. Database Schema ✅ Implemented

Migration applied: `prisma/migrations/20260310014419_init_queue/`

### Enums

```prisma
enum PatientStatus { WAITING · TRIAGED · WITH_DOCTOR · DONE }
enum StaffRole     { NURSE · DOCTOR }
```

### New live-queue tables

**`queue_patients`** — one row per demo patient in the ER right now
```
id, hadm_id (FK → clinical_cases), subject_id,
arrived_at, status, queue_position,
severity_score, confidence_score, contradictions (Json),
ai_summary, scored_at
```
Note: `aiReasoning` is NOT stored — streamed live on demand.

**`notes`** — doctor and nurse notes per visit
```
id, patient_id (FK → queue_patients), role, content, created_at
```

**`scoring_feedback`** — RL preference signal (every doctor override)
```
id, patient_id (FK → queue_patients),
original_rank, adjusted_rank, adjusted_by, note, created_at
```

### Read-only MIMIC tables (seeded from CSVs)

- `clinical_cases` · `labs_subset` · `prescriptions_subset`
- `diagnoses_subset` · `lab_dictionary` · `diagnosis_dictionary`

### Key relationships

```
ClinicalCase ──(hadmId)── QueuePatient ──── Note[]
                                    └────── ScoringFeedback[]
```

---

## 15. Build Order (Recommended)

Given hackathon timeline with 1 day reserved for QA/security:


| Day       | Tasks                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| **Day 1** | Prisma schema + migrations, seed script, basic queue page UI                                                     |
| **Day 2** | AI scoring engine (Vercel AI SDK + tools), contradiction detection, patient detail page with streaming reasoning |
| **Day 3** | Override modal + SSE real-time sync, RL feedback counter, low-confidence flag UI, polish                         |
| **Day 4** | QA, demo prep, security review, rehearse the 3 AM narrative                                                      |


---

## 16. Pitch Framing

**The problem:** At 3 AM in a Canadian ER, 20 patients are waiting. Nurses are tired. Doctors are overloaded. Critical patients get missed in the noise.

**The solution:** The moment a nurse completes triage, the AI instantly cross-references the patient's entire prior history — labs, prescriptions, diagnoses — and surfaces contradictions the chart would bury. The queue reorders itself. The doctor, from their bay, sees the reasoning live. One drag. One sentence. The nurse knows within 20 seconds. A life is not lost to communication overhead.

**Why it works even when the AI is wrong:** The system saves enough review time that the doctor has the bandwidth to catch and correct the AI's mistakes. The override isn't a fallback — it's the feature. And every correction makes the system smarter.

**The demo moment:** *"Dr. Chen sees patient #6. Moderate AI score. But she notices the ⚠️ low confidence flag. She clicks in. The AI is still thinking — live, streaming — 'Warfarin prescribed... INR is 6.9... this is a bleeding risk.' She drags to #1. Types one sentence. The nurse's panel lights up. 20 seconds. No phone call."*