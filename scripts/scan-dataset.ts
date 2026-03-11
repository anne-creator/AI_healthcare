/**
 * scripts/scan-dataset.ts
 *
 * Scans the MIMIC dataset and selects 15 real hadm_ids for the demo queue.
 * Output is written to scripts/scan-output.json for use by seed.ts.
 *
 * Run with: pnpm tsx scripts/scan-dataset.ts
 */

import { gunzipSync } from 'zlib'
import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClinicalCase {
  case_id: string
  subject_id: string
  hadm_id: string
  age: string
  gender: string
  admission_diagnosis: string
  discharge_summary: string
}

interface Lab {
  hadm_id: string
  itemid: string
  charttime: string
  value: string
  unit: string
}

interface LabDictEntry {
  itemid: string
  lab_name: string
  fluid: string
  category: string
}

interface Prescription {
  subject_id: string
  hadm_id: string
  drug: string
  dose_value: string
  dose_unit: string
  route: string
  startdate: string
  enddate: string
}

interface Diagnosis {
  subject_id: string
  hadm_id: string
  seq_num: string
  icd9_code: string
}

interface DiagnosisDictEntry {
  icd9_code: string
  short_title: string
  long_title: string
}

interface SelectedCase {
  slot: string
  hadm_id: string
  subject_id: string
  age: number
  gender: string
  admission_diagnosis: string
  reason: string
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW'
  estimatedSeverityScore: number
  estimatedConfidenceScore: number
  contradictions: string[]
  priorAdmissionsCount: number
  labCount: number
  prescriptionCount: number
  diagnosisCodes: string[]
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

const DATASETS_DIR = path.join(process.cwd(), 'datasets')

function loadGzipCsv<T>(filename: string): T[] {
  const filePath = path.join(DATASETS_DIR, filename)
  const compressed = readFileSync(filePath)
  const decompressed = gunzipSync(compressed).toString('utf-8')
  return parse(decompressed, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[]
}

// clinical_cases stores hadm_id as '149568.0' — normalize to '149568'
function normalizeId(id: string): string {
  return id.includes('.') ? id.split('.')[0] : id
}

// ---------------------------------------------------------------------------
// Drug name matchers
// ---------------------------------------------------------------------------

const METFORMIN_NAMES = ['metformin', 'glucophage', 'fortamet', 'glumetza', 'riomet']
const ACE_INHIBITOR_NAMES = [
  'lisinopril', 'enalapril', 'ramipril', 'captopril', 'perindopril',
  'benazepril', 'fosinopril', 'quinapril', 'trandolapril', 'moexipril',
]
const NSAID_NAMES = [
  'ibuprofen', 'naproxen', 'indomethacin', 'ketorolac',
  'meloxicam', 'diclofenac', 'celecoxib', 'etodolac',
]

function matchesDrug(drugName: string, targets: string[]): boolean {
  const lower = drugName.toLowerCase()
  return targets.some((t) => lower.includes(t))
}

// ---------------------------------------------------------------------------
// ICD-9 code matchers
// ---------------------------------------------------------------------------

function isAcuteMI(code: string): boolean {
  return code.startsWith('410')
}
function isCHF(code: string): boolean {
  return code.startsWith('428')
}
function isSepsis(code: string): boolean {
  return code.startsWith('038') || code === '99591' || code === '99592'
}
function isRespiratoryFailure(code: string): boolean {
  return code === '51881' || code === '51882' || code === '51884'
}
function isStroke(code: string): boolean {
  return code.startsWith('434') || code === '436'
}
function isPneumonia(code: string): boolean {
  return code === '486' || code === '481' || code.startsWith('482') || code.startsWith('483')
}
function isCKD(code: string): boolean {
  return code.startsWith('585')
}
function isDiabetes(code: string): boolean {
  return code.startsWith('250')
}
function isCOPD(code: string): boolean {
  return code === '496' || code.startsWith('491') || code.startsWith('492')
}

// Critical = MI, sepsis, respiratory failure, stroke
function isCriticalDiagnosis(code: string): boolean {
  return isAcuteMI(code) || isSepsis(code) || isRespiratoryFailure(code) || isStroke(code)
}

// ---------------------------------------------------------------------------
// Lab value helpers
// ---------------------------------------------------------------------------

function parseLabValue(value: string): number | null {
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

// Specific itemids for reliable blood lab lookups
const BLOOD_CREATININE_ITEMID = '50912'           // Creatinine (Blood) — normal range 0.4–1.2
const BLOOD_POTASSIUM_ITEMIDS = ['50971', '50822'] // Potassium / Potassium Whole Blood — normal 3.5–5.0
const INR_ITEMID = '51237'                         // INR(PT) — normal 0.8–1.2

// Find max value for a specific itemid, clamped to a realistic range
function findLabByItemId(
  hadmLabs: Lab[],
  itemid: string | string[],
  min: number,
  max: number,
): number | null {
  const ids = Array.isArray(itemid) ? itemid : [itemid]
  const values = hadmLabs
    .filter((l) => ids.includes(l.itemid))
    .map((l) => parseLabValue(l.value))
    .filter((v): v is number => v !== null && v >= min && v <= max)
  if (values.length === 0) return null
  return Math.max(...values)
}

// ---------------------------------------------------------------------------
// Contradiction detection
// ---------------------------------------------------------------------------

function detectContradictions(
  drugs: string[],
  hadmLabs: Lab[],
  labDict: Map<string, LabDictEntry>,
  diagCodes: string[],
): string[] {
  const contradictions: string[] = []

  const hasMetformin = drugs.some((d) => matchesDrug(d, METFORMIN_NAMES))
  const hasAceInhibitor = drugs.some((d) => matchesDrug(d, ACE_INHIBITOR_NAMES))
  const hasNSAID = drugs.some((d) => matchesDrug(d, NSAID_NAMES))
  const hasCKDCode = diagCodes.some(isCKD)

  const creatinine = findLabByItemId(hadmLabs, BLOOD_CREATININE_ITEMID, 0.2, 20)
  const potassium  = findLabByItemId(hadmLabs, BLOOD_POTASSIUM_ITEMIDS, 1.0, 10)
  const inr        = findLabByItemId(hadmLabs, INR_ITEMID, 0.5, 15)

  // Metformin + renal impairment
  if (hasMetformin) {
    if (creatinine !== null && creatinine > 1.5) {
      contradictions.push(
        `Metformin prescribed — Creatinine elevated at ${creatinine.toFixed(1)} mg/dL (contraindicated > 1.5)`,
      )
    }
    if (hasCKDCode) {
      contradictions.push('Metformin prescribed — Active CKD diagnosis on record')
    }
  }

  // ACE inhibitor + hyperkalemia
  if (hasAceInhibitor && potassium !== null && potassium > 5.5) {
    contradictions.push(
      `ACE inhibitor prescribed — Potassium elevated at ${potassium.toFixed(1)} mEq/L (threshold: 5.5)`,
    )
  }

  // Warfarin + supratherapeutic INR
  const hasWarfarin = drugs.some((d) => d.toLowerCase().includes('warfarin'))
  if (hasWarfarin && inr !== null && inr > 3.5) {
    contradictions.push(
      `Warfarin prescribed — INR supratherapeutic at ${inr.toFixed(1)} (therapeutic range 2.0–3.0)`,
    )
  }

  // NSAID + renal impairment
  if (hasNSAID && hasCKDCode) {
    contradictions.push('NSAID prescribed — Active CKD diagnosis (NSAIDs worsen renal function)')
  }

  // NSAID + CHF
  if (hasNSAID && diagCodes.some(isCHF)) {
    contradictions.push('NSAID prescribed — Active CHF diagnosis (NSAIDs cause fluid retention)')
  }

  return contradictions
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

// Severity score 0–100 based on diagnoses, contradictions, critical labs
function estimateSeverity(
  diagCodes: string[],
  contradictions: string[],
  hadmLabs: Lab[],
): number {
  let score = 20 // baseline

  if (diagCodes.some(isCriticalDiagnosis)) score += 50
  else if (diagCodes.some((c) => isCHF(c) || isStroke(c))) score += 35
  else if (diagCodes.some((c) => isPneumonia(c) || isCOPD(c))) score += 20
  else if (diagCodes.some(isDiabetes)) score += 10

  score += Math.min(contradictions.length * 10, 20)

  const creatinine = findLabByItemId(hadmLabs, BLOOD_CREATININE_ITEMID, 0.2, 20)
  if (creatinine !== null && creatinine > 3.0) score += 8

  const potassium = findLabByItemId(hadmLabs, BLOOD_POTASSIUM_ITEMIDS, 1.0, 10)
  if (potassium !== null && (potassium < 2.5 || potassium > 6.5)) score += 8

  return Math.min(score, 100)
}

// Confidence score 0–100 based on data richness
function estimateConfidence(labCount: number, rxCount: number, diagCount: number): number {
  const dataPoints = labCount + rxCount * 3 + diagCount * 2
  if (dataPoints >= 60) return 85 + Math.min(Math.floor(dataPoints / 20), 15)
  if (dataPoints >= 30) return 65 + Math.floor(dataPoints / 3)
  if (dataPoints >= 10) return 40 + dataPoints
  return Math.max(15, dataPoints * 3)
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

async function main() {
  console.log('Loading dataset files...')

  const clinicalCases = loadGzipCsv<ClinicalCase>('clinical_cases.csv.gz')
  const labs = loadGzipCsv<Lab>('labs_subset.csv.gz')
  const labDictRaw = loadGzipCsv<LabDictEntry>('lab_dictionary.csv.gz')
  const prescriptions = loadGzipCsv<Prescription>('prescriptions_subset.csv.gz')
  const diagnoses = loadGzipCsv<Diagnosis>('diagnoses_subset.csv.gz')

  console.log(`Loaded ${clinicalCases.length} admissions`)

  // Build indexes
  const labsByAdmission = new Map<string, Lab[]>()
  for (const lab of labs) {
    const key = normalizeId(lab.hadm_id)
    const list = labsByAdmission.get(key) ?? []
    list.push(lab)
    labsByAdmission.set(key, list)
  }

  const rxByAdmission = new Map<string, Prescription[]>()
  for (const rx of prescriptions) {
    const key = normalizeId(rx.hadm_id)
    const list = rxByAdmission.get(key) ?? []
    list.push(rx)
    rxByAdmission.set(key, list)
  }

  const diagByAdmission = new Map<string, Diagnosis[]>()
  for (const diag of diagnoses) {
    const key = normalizeId(diag.hadm_id)
    const list = diagByAdmission.get(key) ?? []
    list.push(diag)
    diagByAdmission.set(key, list)
  }

  const admissionsByPatient = new Map<string, ClinicalCase[]>()
  for (const c of clinicalCases) {
    const key = normalizeId(c.subject_id)
    const list = admissionsByPatient.get(key) ?? []
    list.push(c)
    admissionsByPatient.set(key, list)
  }

  const labDict = new Map<string, LabDictEntry>()
  for (const entry of labDictRaw) {
    labDict.set(entry.itemid, entry)
  }

  // ---------------------------------------------------------------------------
  // Score every admission
  // ---------------------------------------------------------------------------

  console.log('Scoring all admissions...')

  interface ScoredAdmission {
    case: ClinicalCase
    diagCodes: string[]
    drugs: string[]
    contradictions: string[]
    severityScore: number
    confidenceScore: number
    labCount: number
    rxCount: number
    priorAdmissionsCount: number
  }

  const scored: ScoredAdmission[] = []

  for (const c of clinicalCases) {
    const hadmKey = normalizeId(c.hadm_id)
    const subjKey = normalizeId(c.subject_id)
    const hadmLabs = labsByAdmission.get(hadmKey) ?? []
    const rxList = rxByAdmission.get(hadmKey) ?? []
    const diagList = diagByAdmission.get(hadmKey) ?? []
    const priorAdmissions = admissionsByPatient.get(subjKey) ?? []

    const diagCodes = diagList.map((d) => d.icd9_code)
    const drugs = rxList.map((r) => r.drug)
    const contradictions = detectContradictions(drugs, hadmLabs, labDict, diagCodes)
    const severityScore = estimateSeverity(diagCodes, contradictions, hadmLabs)
    const confidenceScore = estimateConfidence(hadmLabs.length, rxList.length, diagList.length)

    scored.push({
      case: c,
      diagCodes,
      drugs,
      contradictions,
      severityScore,
      confidenceScore,
      labCount: hadmLabs.length,
      rxCount: rxList.length,
      priorAdmissionsCount: priorAdmissions.length - 1, // exclude current
    })
  }

  // ---------------------------------------------------------------------------
  // Select candidates per slot
  // ---------------------------------------------------------------------------

  const used = new Set<string>() // track used hadm_ids to avoid duplicates
  const selected: SelectedCase[] = []

  function pick(
    slot: string,
    count: number,
    filter: (s: ScoredAdmission) => boolean,
    sortBy: (s: ScoredAdmission) => number,
    reason: (s: ScoredAdmission) => string,
    severity: SelectedCase['severity'],
  ) {
    const candidates = scored
      .filter((s) => !used.has(s.case.hadm_id) && filter(s))
      .sort((a, b) => sortBy(b) - sortBy(a))
      .slice(0, count * 5) // over-fetch then take best

    let picked = 0
    for (const s of candidates) {
      if (picked >= count) break
      if (used.has(normalizeId(s.case.hadm_id))) continue
      used.add(normalizeId(s.case.hadm_id))
      selected.push({
        slot,
        hadm_id: normalizeId(s.case.hadm_id),
        subject_id: normalizeId(s.case.subject_id),
        age: parseInt(s.case.age, 10),
        gender: s.case.gender,
        admission_diagnosis: s.case.admission_diagnosis,
        reason: reason(s),
        severity,
        estimatedSeverityScore: s.severityScore,
        estimatedConfidenceScore: s.confidenceScore,
        contradictions: s.contradictions,
        priorAdmissionsCount: s.priorAdmissionsCount,
        labCount: s.labCount,
        prescriptionCount: s.rxCount,
        diagnosisCodes: s.diagCodes.slice(0, 5),
      })
      picked++
    }
    if (picked < count) {
      console.warn(`⚠️  Slot "${slot}": requested ${count}, found only ${picked}`)
    }
  }

  // Slot 1–2: Metformin + renal impairment
  pick(
    'drug_contradiction_metformin',
    2,
    (s) =>
      s.contradictions.some((c) => c.toLowerCase().includes('metformin')) &&
      s.severityScore >= 50,
    (s) => s.severityScore,
    (s) => s.contradictions.find((c) => c.toLowerCase().includes('metformin')) ?? '',
    'HIGH',
  )

  // Slot 3: ACE inhibitor + hyperkalemia
  pick(
    'drug_contradiction_ace_inhibitor',
    1,
    (s) => s.contradictions.some((c) => c.toLowerCase().includes('ace inhibitor')),
    (s) => s.severityScore,
    (s) => s.contradictions.find((c) => c.toLowerCase().includes('ace inhibitor')) ?? '',
    'HIGH',
  )

  // Slot 4–5: High severity, high confidence
  pick(
    'high_severity_high_confidence',
    2,
    (s) => s.severityScore >= 75 && s.confidenceScore >= 70,
    (s) => s.severityScore + s.confidenceScore,
    (s) =>
      `Severity ${s.severityScore}, Confidence ${s.confidenceScore} — ${s.diagCodes.slice(0, 2).join(', ')}`,
    'CRITICAL',
  )

  // Slot 6–7: High severity, LOW confidence (sparse data — needs human review)
  pick(
    'high_severity_low_confidence',
    2,
    (s) => s.severityScore >= 65 && s.confidenceScore < 50,
    (s) => s.severityScore - s.confidenceScore, // maximize gap
    (s) =>
      `High severity (${s.severityScore}) but low data confidence (${s.confidenceScore}) — flag for nurse review`,
    'HIGH',
  )

  // Slot 8–9: Multiple prior admissions (longitudinal history value)
  pick(
    'multiple_prior_admissions',
    2,
    (s) => s.priorAdmissionsCount >= 1 && s.severityScore >= 40,
    (s) => s.priorAdmissionsCount,
    (s) =>
      `${s.priorAdmissionsCount} prior admissions on record — rich longitudinal history available`,
    'MODERATE',
  )

  // Slot 10–12: Moderate severity (CHF, COPD, DM with active meds)
  pick(
    'moderate_severity',
    3,
    (s) =>
      s.severityScore >= 35 &&
      s.severityScore < 70 &&
      (s.diagCodes.some(isCHF) || s.diagCodes.some(isCOPD) || s.diagCodes.some(isDiabetes)),
    (s) => s.rxCount + s.labCount,
    (s) => `Moderate severity chronic condition — ${s.diagCodes.slice(0, 2).join(', ')}`,
    'MODERATE',
  )

  // Slot 13–14: Low severity (routine, good queue contrast)
  pick(
    'low_severity',
    2,
    (s) => s.severityScore < 35 && s.contradictions.length === 0 && s.labCount > 2,
    (s) => -s.severityScore, // lowest severity first
    (s) => `Low severity presentation — ${s.case.admission_diagnosis}`,
    'LOW',
  )

  // Slot 15: Override demo — contradiction present but moderate/ambiguous severity
  // AI will rank this middling; doctor overrides up during live demo to show RL feedback
  pick(
    'override_demo',
    1,
    (s) => s.contradictions.length >= 1 && s.severityScore >= 40 && s.severityScore < 80,
    (s) => s.contradictions.length * 10 + s.severityScore,
    (s) =>
      `Demo override case — ${s.contradictions.length} contradiction(s), severity ${s.severityScore}. Doctor will override rank live to trigger RL feedback loop.`,
    'MODERATE',
  )

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  const output = {
    scanDate: new Date().toISOString(),
    totalAdmissionsScanned: clinicalCases.length,
    selectedCount: selected.length,
    slotSummary: Object.entries(
      selected.reduce<Record<string, number>>((acc, s) => {
        acc[s.slot] = (acc[s.slot] ?? 0) + 1
        return acc
      }, {}),
    ),
    selectedCases: selected,
  }

  const outputPath = path.join(process.cwd(), 'scripts', 'scan-output.json')
  writeFileSync(outputPath, JSON.stringify(output, null, 2))

  // Print summary
  console.log('\n✅ Scan complete')
  console.log(`   Total admissions scanned : ${output.totalAdmissionsScanned}`)
  console.log(`   Cases selected           : ${output.selectedCount} / 15`)
  console.log('\n📋 Selected cases:\n')

  for (const c of selected) {
    const flag = c.estimatedConfidenceScore < 50 ? ' ⚠️  LOW CONFIDENCE' : ''
    console.log(
      `  [${c.slot}] hadm_id=${c.hadm_id} age=${c.age}${c.gender} severity=${c.estimatedSeverityScore} confidence=${c.estimatedConfidenceScore}${flag}`,
    )
    console.log(`    Reason: ${c.reason}`)
    if (c.contradictions.length > 0) {
      for (const con of c.contradictions) {
        console.log(`    ⚡ ${con}`)
      }
    }
    console.log()
  }

  console.log(`📄 Full output saved to scripts/scan-output.json`)
  console.log('   Next step: run pnpm tsx scripts/seed.ts to load into the database')
}

main().catch((err) => {
  console.error('Scan failed:', err)
  process.exit(1)
})
