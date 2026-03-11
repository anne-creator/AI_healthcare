/**
 * scripts/test-ai-scoring.ts
 * Functional tests for the AI scoring engine and streaming reasoning.
 * Run: pnpm tsx scripts/test-ai-scoring.ts
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
// Test 1: Score a single patient with known contradictions
// hadm_id 148037: Metformin + Creatinine 1.6, Warfarin + INR 6.9
// ---------------------------------------------------------------------------
async function testSinglePatientScoring() {
  console.log("\n🧪 Test 1: POST /api/ai/score — single patient (hadm_id 148037)");

  const res = await fetch(`${BASE}/api/ai/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hadmId: 148037 }),
  });

  assert(res.ok, `responds 200 (got ${res.status})`);
  if (!res.ok) {
    const err = await res.text();
    console.log(`    Response: ${err}`);
    return null;
  }

  const data = await res.json();
  assert(data.scoring !== undefined, "response has scoring object");

  const s = data.scoring;
  assert(typeof s.severityScore === "number", `severityScore is number (${s.severityScore})`);
  assert(s.severityScore >= 0 && s.severityScore <= 100, `severityScore in range 0-100 (${s.severityScore})`);
  assert(s.severityScore > 50, `severityScore > 50 for high-severity patient (${s.severityScore})`);

  assert(typeof s.confidenceScore === "number", `confidenceScore is number (${s.confidenceScore})`);
  assert(s.confidenceScore >= 0 && s.confidenceScore <= 100, `confidenceScore in range 0-100 (${s.confidenceScore})`);

  assert(Array.isArray(s.contradictions), "contradictions is array");
  assert(s.contradictions.length > 0, `found contradictions (${s.contradictions.length})`);

  if (s.contradictions.length > 0) {
    const c = s.contradictions[0];
    assert(typeof c.severity === "string", `contradiction has severity (${c.severity})`);
    assert(typeof c.title === "string", `contradiction has title (${c.title})`);
    assert(typeof c.drug === "string", `contradiction has drug (${c.drug})`);
    assert(typeof c.action === "string", `contradiction has action`);
  }

  assert(typeof s.summary === "string" && s.summary.length > 20, `summary is meaningful string (${s.summary.length} chars)`);
  assert(Array.isArray(s.recommendedActions), "recommendedActions is array");

  return data;
}

// ---------------------------------------------------------------------------
// Test 2: Verify DB persistence — scored patient shows up in queue
// ---------------------------------------------------------------------------
async function testDBPersistence() {
  console.log("\n🧪 Test 2: GET /api/queue — verify DB persistence");

  const res = await fetch(`${BASE}/api/queue`);
  assert(res.ok, "queue responds 200");

  const data = await res.json();
  const patient = data.patients.find(
    (p: { hadmId: number }) => p.hadmId === 148037
  );

  assert(patient !== undefined, "patient 148037 found in queue");
  if (patient) {
    assert(patient.severityScore !== null, `severityScore persisted (${patient.severityScore})`);
    assert(patient.confidenceScore !== null, `confidenceScore persisted (${patient.confidenceScore})`);
    assert(patient.aiSummary !== null, `aiSummary persisted (${patient.aiSummary?.length} chars)`);
    assert(patient.contradictions !== null, `contradictions persisted`);
    assert(patient.scoredAt !== null, `scoredAt timestamp set`);
  }
}

// ---------------------------------------------------------------------------
// Test 3: Streaming reasoning endpoint
// ---------------------------------------------------------------------------
async function testStreamingReasoning() {
  console.log("\n🧪 Test 3: POST /api/ai/reason — streaming reasoning");

  const res = await fetch(`${BASE}/api/ai/reason`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hadmId: 148037 }),
  });

  assert(res.ok, `responds 200 (got ${res.status})`);
  if (!res.ok) {
    const err = await res.text();
    console.log(`    Response: ${err}`);
    return;
  }

  const contentType = res.headers.get("content-type") ?? "";
  assert(
    contentType.includes("text/plain") || contentType.includes("text/event-stream") || contentType.includes("octet-stream"),
    `content-type is streaming (${contentType})`
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let chunkCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    chunkCount++;
    if (chunkCount >= 5 || fullText.length > 500) break;
  }

  reader.cancel();

  assert(chunkCount > 0, `received ${chunkCount} stream chunks`);
  assert(fullText.length > 50, `received meaningful text (${fullText.length} chars)`);

  console.log(`\n  📝 First ~500 chars of streaming reasoning:`);
  console.log(`  ${fullText.slice(0, 500).replace(/\n/g, "\n  ")}`);
}

// ---------------------------------------------------------------------------
// Test 4: Validation — missing hadmId
// ---------------------------------------------------------------------------
async function testValidation() {
  console.log("\n🧪 Test 4: Validation — bad requests");

  const r1 = await fetch(`${BASE}/api/ai/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(r1.status === 400, `score with empty body → 400 (got ${r1.status})`);

  const r2 = await fetch(`${BASE}/api/ai/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hadmId: 999999 }),
  });
  assert(r2.status === 404, `score with nonexistent hadmId → 404 (got ${r2.status})`);
}

// ---------------------------------------------------------------------------
// Test 5: Quality review — print full scoring output
// ---------------------------------------------------------------------------
async function testQualityReview(scoringData: { scoring: Record<string, unknown> } | null) {
  console.log("\n🧪 Test 5: Quality Review — full scoring output for hadm_id 148037");

  if (!scoringData) {
    console.log("  ⚠️  SKIP: no scoring data from Test 1");
    return;
  }

  const s = scoringData.scoring as {
    severityScore: number;
    confidenceScore: number;
    contradictions: Array<{
      severity: string;
      title: string;
      description: string;
      drug: string;
      labOrDiagnosis: string;
      action: string;
    }>;
    summary: string;
    recommendedActions: string[];
  };

  console.log(`\n  Severity Score:    ${s.severityScore}/100`);
  console.log(`  Confidence Score:  ${s.confidenceScore}/100`);
  console.log(`  Summary: ${s.summary}`);
  console.log(`  Contradictions (${s.contradictions.length}):`);
  for (const c of s.contradictions) {
    console.log(`    [${c.severity}] ${c.title}`);
    console.log(`      Drug: ${c.drug} | Finding: ${c.labOrDiagnosis}`);
    console.log(`      Action: ${c.action}`);
  }
  console.log(`  Recommended Actions:`);
  for (const a of s.recommendedActions) {
    console.log(`    - ${a}`);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
  console.log("🏥 AI Scoring Engine Test Suite");
  console.log(`   Target: ${BASE}`);
  console.log("   Testing: /api/ai/score, /api/ai/reason, DB persistence\n");

  let scoringData: { scoring: Record<string, unknown> } | null = null;

  try {
    scoringData = await testSinglePatientScoring();
    await testDBPersistence();
    await testStreamingReasoning();
    await testValidation();
    await testQualityReview(scoringData);
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
