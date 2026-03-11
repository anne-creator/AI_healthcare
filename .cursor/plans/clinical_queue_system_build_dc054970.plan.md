---
name: Clinical Queue System Build
overview: Transform the existing MIMIC patient browser into the live ER queue system described in the product spec — 8 features across Backend, AI, and UI portions, built against the existing Prisma schema and 14 seeded queue patients.
todos:
  - id: backend-queue-api
    content: "Backend: Queue API (`/api/queue`) — GET reads `queue_patients` joined with `clinical_cases` (name, age, gender, diagnosis, severity, confidence, contradictions, status, position). Returns sorted by `queuePosition`. PATCH for reorder (accepts `patientId` + `newPosition`, shifts others). This replaces the current `/api/patients` usage on the home page."
    status: pending
  - id: backend-status-api
    content: "Backend: Status transition API (`/api/queue/status`) — PATCH accepts `patientId` + `newStatus`. Enforces WAITING->TRIAGED->WITH_DOCTOR->DONE ordering. Used by nurse view to advance patients."
    status: pending
  - id: backend-feedback-api
    content: "Backend: Override/Feedback API (`/api/queue/feedback`) — POST writes `ScoringFeedback` record (originalRank, adjustedRank, note, adjustedBy=DOCTOR). Also writes a `Note` record. Returns updated queue. Triggers SSE."
    status: pending
  - id: backend-sse
    content: "Backend: SSE endpoint (`/api/queue/stream`) — GET returns `text/event-stream`. Emits `queue_updated` event whenever queue changes (status change, reorder, new score). Simple polling-based approach: keep a global version counter, SSE clients poll against it."
    status: pending
  - id: ai-install-sdk
    content: "AI: Install Vercel AI SDK — `pnpm add ai @ai-sdk/anthropic`. Update [`lib/ai.ts`](src/lib/ai.ts) to export a Vercel AI SDK Anthropic provider alongside the existing direct client."
    status: pending
  - id: ai-scoring-engine
    content: "AI: Scoring engine (`/api/ai/score`) — New route. Uses Vercel AI SDK `generateObject` with tool use. Tools: `query_labs`, `query_prescriptions`, `query_diagnoses`, `query_prior_admissions`. Returns `{ severityScore, confidenceScore, contradictions[], summary, recommendedActions[] }`. Runs per-patient, writes results to `queue_patients` row. Includes the 6 contradiction rules from the spec (Metformin+creatinine, Metformin+CKD, ACE+K+, Warfarin+INR, NSAID+CKD, NSAID+CHF)."
    status: pending
  - id: ai-streaming-reasoning
    content: "AI: Streaming reasoning (`/api/ai/reason` rewrite) — Replace current direct Anthropic call with Vercel AI SDK `streamText` + extended thinking (`providerOptions.anthropic.thinking`). Streams token-by-token reasoning for the patient detail page. Budget: 8000-12000 thinking tokens."
    status: pending
  - id: ai-rl-injection
    content: "AI: RL preference injection — Before each scoring call, query the 5 most recent `ScoringFeedback` records with notes. Inject as few-shot examples in the system prompt: 'In a previous case, doctor elevated priority because...' This makes overrides influence future scores immediately."
    status: pending
  - id: ui-queue-page
    content: "UI: Queue page (`/`) — Replace current patient list with the queue view. 14 patient cards sorted by queue position. Each card shows: severity badge (color-coded CRITICAL/HIGH/MODERATE/LOW), status chip (monochrome WAITING/TRIAGED/WITH_DOCTOR/DONE), patient name/age/gender, chief complaint, AI summary, severity+confidence bars, contradiction count. Drag-to-reorder with `@dnd-kit`. Low confidence (<60) gets amber border + warning icon."
    status: pending
  - id: ui-doctor-nurse-toggle
    content: "UI: Doctor/Nurse mode toggle — Toggle in queue header. Doctor mode: sees AWAITING_DOCTOR patients sorted by severity, can drag-reorder and override. Nurse mode: sees all statuses, can click status chips to advance (WAITING->TRIAGED->WITH_DOCTOR->DONE), sees doctor override notifications. Both share the same `/` page."
    status: pending
  - id: ui-patient-detail
    content: "UI: Patient detail page (`/patients/[id]`) — Refactor to queue-aware. Add streaming AI reasoning panel (collapsible, open by default) using `useChat` or custom streaming hook. Show contradiction flags with severity + action. Keep existing labs/meds/diagnoses blocks. Add status badge and time-waiting in header."
    status: pending
  - id: ui-override-modal
    content: "UI: Override modal — Triggered on drag-drop in doctor mode. Shows: patient name, current position -> new position, AI suggested position, optional reason textarea. On confirm: calls feedback API, queue reorders, SSE fires. Uses shadcn Dialog."
    status: pending
  - id: ui-rl-counter
    content: "UI: RL counter — In queue header, show 'Model refined from N doctor corrections' by querying `scoring_feedback` count. Increments live after each override via SSE."
    status: pending
isProject: false
---

# Clinical Reasoning Engine — Build Plan

## Current State

The app is a **patient browser** for 2000 MIMIC records. The home page (`[src/app/page.tsx](src/app/page.tsx)`) reads `clinical_cases` via `/api/patients`, not `queue_patients`. The detail page (`[src/app/patients/[hadm_id]/page.tsx](src/app/patients/[hadm_id]/page.tsx)`) renders static data. The AI route (`[src/app/api/ai/reason/route.ts](src/app/api/ai/reason/route.ts)`) uses the direct Anthropic SDK (no streaming, no tool use, no scoring). **Vercel AI SDK is not installed.** The `queue_patients` table has 14 seeded rows that nothing reads yet.

## Architecture Overview

```mermaid
flowchart LR
    subgraph ui [UI Layer]
        QueuePage["/ Queue Page"]
        DetailPage["/patients/id Detail"]
        OverrideModal["Override Modal"]
        NurseToggle["Nurse/Doctor Toggle"]
    end

    subgraph backend [Backend Layer]
        QueueAPI["/api/queue"]
        StatusAPI["/api/queue/status"]
        FeedbackAPI["/api/queue/feedback"]
        SSE["/api/queue/stream SSE"]
    end

    subgraph ai [AI Layer]
        ScoringEngine["/api/ai/score"]
        ReasoningStream["/api/ai/reason streaming"]
        RLInjection["RL Preference Injection"]
    end

    subgraph db [Database]
        QueuePatients["queue_patients"]
        ScoringFeedback["scoring_feedback"]
        Notes["notes"]
        MIMIC["clinical_cases + labs + rx + dx"]
    end

    QueuePage --> QueueAPI
    QueuePage --> SSE
    DetailPage --> ReasoningStream
    OverrideModal --> FeedbackAPI
    NurseToggle --> StatusAPI

    QueueAPI --> QueuePatients
    StatusAPI --> QueuePatients
    FeedbackAPI --> ScoringFeedback
    SSE --> QueuePatients

    ScoringEngine --> MIMIC
    ScoringEngine --> QueuePatients
    ReasoningStream --> MIMIC
    RLInjection --> ScoringFeedback
```



