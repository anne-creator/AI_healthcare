/**
 * scripts/test-queue-api.ts
 * Validates all queue backend APIs against the running dev server.
 * Run: pnpm tsx scripts/test-queue-api.ts
 *
 * Prereqs: pnpm dev running on port 3000, queue seeded (pnpm db:seed:queue)
 */

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: GET /api/queue — full list
// ---------------------------------------------------------------------------
async function testGetQueue() {
  console.log("\n🧪 Test 1: GET /api/queue");
  const res = await fetch(`${BASE}/api/queue`);
  assert(res.ok, "responds 200");

  const data = await res.json();
  assert(Array.isArray(data.patients), "returns patients array");
  assert(data.patients.length === 14, `has 14 patients (got ${data.patients.length})`);

  const positions = data.patients.map((p: { queuePosition: number }) => p.queuePosition);
  const sorted = [...positions].sort((a: number, b: number) => a - b);
  assert(
    JSON.stringify(positions) === JSON.stringify(sorted),
    "patients sorted by queuePosition ascending"
  );

  const first = data.patients[0];
  assert(typeof first.id === "string", "patient has id (cuid)");
  assert(typeof first.hadmId === "number", "patient has hadmId");
  assert(typeof first.age === "number", "patient has age (joined from clinical_cases)");
  assert(typeof first.gender === "string", "patient has gender");
  assert(typeof first.admissionDiagnosis === "string", "patient has admissionDiagnosis");
  assert(typeof first.status === "string", "patient has status");

  return data.patients;
}

// ---------------------------------------------------------------------------
// Test 2: GET /api/queue?status=TRIAGED — filtered
// ---------------------------------------------------------------------------
async function testGetQueueFiltered() {
  console.log("\n🧪 Test 2: GET /api/queue?status=TRIAGED");
  const res = await fetch(`${BASE}/api/queue?status=TRIAGED`);
  assert(res.ok, "responds 200");

  const data = await res.json();
  const allTriaged = data.patients.every(
    (p: { status: string }) => p.status === "TRIAGED"
  );
  assert(allTriaged, `all patients have status=TRIAGED (count: ${data.patients.length})`);
  assert(data.patients.length > 0, "at least 1 TRIAGED patient exists");
}

// ---------------------------------------------------------------------------
// Test 3: PATCH /api/queue — reorder
// ---------------------------------------------------------------------------
async function testReorder(patients: { id: string; queuePosition: number }[]) {
  console.log("\n🧪 Test 3: PATCH /api/queue — reorder");

  // Find two patients with distinct positions to swap
  const triaged = patients.filter((p: { queuePosition: number }) => p.queuePosition > 0);
  if (triaged.length < 2) {
    console.log("  ⚠️  SKIP: need at least 2 patients with queuePosition > 0");
    return;
  }

  const target = triaged[0];
  const newPos = triaged[triaged.length - 1].queuePosition;

  const res = await fetch(`${BASE}/api/queue`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: target.id, newPosition: newPos }),
  });
  assert(res.ok, `responds 200 (move ${target.id} from pos ${target.queuePosition} → ${newPos})`);

  const data = await res.json();
  const moved = data.patients.find(
    (p: { id: string }) => p.id === target.id
  );
  assert(
    moved?.queuePosition === newPos,
    `patient now at position ${newPos} (got ${moved?.queuePosition})`
  );

  // Move it back so other tests aren't affected
  await fetch(`${BASE}/api/queue`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: target.id, newPosition: target.queuePosition }),
  });
}

// ---------------------------------------------------------------------------
// Test 4: PATCH /api/queue/status — valid and invalid transitions
// ---------------------------------------------------------------------------
async function testStatusTransition(patients: { id: string; status: string }[]) {
  console.log("\n🧪 Test 4: PATCH /api/queue/status — transitions");

  const waiting = patients.find((p) => p.status === "WAITING");
  if (!waiting) {
    console.log("  ⚠️  SKIP: no WAITING patient found");
    return;
  }

  // Valid: WAITING → TRIAGED
  const res = await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: waiting.id, newStatus: "TRIAGED" }),
  });
  assert(res.ok, "WAITING → TRIAGED succeeds (200)");

  const data = await res.json();
  assert(data.patient?.status === "TRIAGED", `patient status is now TRIAGED`);

  // Invalid: TRIAGED → DONE (skipping WITH_DOCTOR)
  const res2 = await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: waiting.id, newStatus: "DONE" }),
  });
  assert(res2.status === 400, "TRIAGED → DONE is rejected (400)");

  const err = await res2.json();
  assert(
    err.error?.includes("Invalid transition"),
    `error message explains invalid transition`
  );

  // Restore: move back to WAITING by re-seeding isn't feasible,
  // so advance through the remaining steps for cleanup
  await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: waiting.id, newStatus: "WITH_DOCTOR" }),
  });
  await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: waiting.id, newStatus: "DONE" }),
  });
  console.log("  ℹ️  Patient advanced to DONE for cleanup");
}

// ---------------------------------------------------------------------------
// Test 5: POST /api/queue/feedback — doctor override
// ---------------------------------------------------------------------------
async function testFeedback(patients: { id: string; queuePosition: number }[]) {
  console.log("\n🧪 Test 5: POST /api/queue/feedback — doctor override");

  const target = patients.find((p) => p.queuePosition > 0);
  if (!target) {
    console.log("  ⚠️  SKIP: no patient with queuePosition > 0");
    return;
  }

  const res = await fetch(`${BASE}/api/queue/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patientId: target.id,
      originalRank: target.queuePosition,
      adjustedRank: 1,
      note: "INR 6.9 — bleeding risk, bring in immediately",
      adjustedBy: "DOCTOR",
    }),
  });
  assert(res.ok, "responds 200");

  const data = await res.json();
  assert(data.feedback?.patientId === target.id, "feedback record has correct patientId");
  assert(data.feedback?.originalRank === target.queuePosition, "feedback has original rank");
  assert(data.feedback?.adjustedRank === 1, "feedback has adjusted rank");
  assert(data.feedback?.adjustedBy === "DOCTOR", "feedback adjustedBy is DOCTOR");
  assert(data.note?.content?.includes("INR 6.9"), "note record created with content");
  assert(data.note?.role === "DOCTOR", "note role is DOCTOR");
  assert(Array.isArray(data.patients), "response includes updated queue");
}

// ---------------------------------------------------------------------------
// Test 6: GET /api/queue/stream — SSE
// ---------------------------------------------------------------------------
async function testSSE() {
  console.log("\n🧪 Test 6: GET /api/queue/stream — SSE");

  const controller = new AbortController();
  let receivedEvent = false;

  const ssePromise = new Promise<void>((resolve) => {
    fetch(`${BASE}/api/queue/stream`, { signal: controller.signal })
      .then(async (res) => {
        assert(res.ok, "SSE responds 200");
        assert(
          res.headers.get("content-type")?.includes("text/event-stream") ?? false,
          "content-type is text/event-stream"
        );

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const readLoop = async () => {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            if (buffer.includes("event: queue_updated")) {
              receivedEvent = true;
              resolve();
              return;
            }
          }
        };
        readLoop().catch(() => {});
      })
      .catch(() => {});
  });

  // Wait a moment for SSE connection to establish, then check if
  // the initial push already triggered the event
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
  await Promise.race([ssePromise, timeout]);

  assert(receivedEvent, "received queue_updated event from SSE stream");
  controller.abort();
}

// ---------------------------------------------------------------------------
// Test 7: Validation — missing fields
// ---------------------------------------------------------------------------
async function testValidation() {
  console.log("\n🧪 Test 7: Validation — missing/bad fields");

  const r1 = await fetch(`${BASE}/api/queue`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(r1.status === 400, "PATCH /api/queue with empty body → 400");

  const r2 = await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: "nonexistent", newStatus: "TRIAGED" }),
  });
  assert(r2.status === 404, "status transition for nonexistent patient → 404");

  const r3 = await fetch(`${BASE}/api/queue/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: "x" }),
  });
  assert(r3.status === 400, "feedback with missing fields → 400");

  const r4 = await fetch(`${BASE}/api/queue/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId: "x", newStatus: "INVALID" }),
  });
  assert(r4.status === 400, "status with invalid enum → 400");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log("🏥 Queue API Test Suite");
  console.log(`   Target: ${BASE}`);
  console.log("   Expecting 14 seeded queue_patients\n");

  try {
    const patients = await testGetQueue();
    await testGetQueueFiltered();
    await testReorder(patients);
    await testStatusTransition(patients);
    await testFeedback(patients);
    await testSSE();
    await testValidation();
  } catch (err) {
    console.error("\n💥 Unexpected error:", err);
    failed++;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
