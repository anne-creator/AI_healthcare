# Clinical Reasoning Engine — MVP Prototype
**Healthcare AI Hackathon · University of Toronto · March 2026**

---

## Patient Queue

| ID | Diagnosis | Alert | Admit | Age | Conflicts |
|----|-----------|-------|-------|-----|-----------|
| PT-0042 | Type 2 Diabetes with CKD Stage 4 | 🔴 ALERT | 02:14 | 67y | ⚠ 2 conflicts detected |
| PT-0117 | Acute MI — Post PCI | 🟡 WATCH | 23:47 | 54y | ⚠ 1 conflict detected |
| PT-0203 | Community-Acquired Pneumonia | 🟢 STABLE | 01:03 | 41y | ✓ No conflicts |

---

## PT-0042 · Type 2 Diabetes with CKD Stage 4
**Age:** 67 · **Admit:** 02:14 · **Status:** 🔴 ALERT

---

### 01 · What Is Wrong

Patient presents with Type 2 Diabetes Mellitus complicated by Chronic Kidney Disease Stage 4. Primary admission trigger was acute glucose dysregulation with concurrent fluid retention.

**Confidence:** 94% · **Source:** `clinical_cases + diagnosis_dictionary`

---

### 02 · What Has Been Tried

| Medication | Frequency | Confidence | Source |
|------------|-----------|------------|--------|
| Metformin 500mg | BID | 97% | `prescriptions_subset` |
| Furosemide 40mg | QD | 95% | `prescriptions_subset` |
| Lisinopril 10mg | QD | 91% | `prescriptions_subset` |

---

### 03 · Watch Right Now

| Finding | Severity | Normal Range | Confidence | Source |
|---------|----------|--------------|------------|--------|
| eGFR critically low at 18 mL/min | 🔴 Critical | >60 | 96% | `labs_subset` |
| Serum Creatinine elevated at 4.2 mg/dL | 🔴 Critical | 0.7–1.3 | 94% | `labs_subset` |
| Potassium high at 5.8 mEq/L | 🟠 High | 3.5–5.0 | 89% | `labs_subset` |

---

### Contradiction Engine — PT-0042

#### ⚠ CRITICAL · Metformin contraindicated — renal failure

Metformin is prescribed but eGFR is critically low at 18 mL/min. Metformin is contraindicated when eGFR falls below 30 due to risk of lactic acidosis.

| Data Point | Value | Source |
|------------|-------|--------|
| Prescription | Metformin 500mg BID active | `prescriptions_subset` |
| Lab Result | eGFR = 18 mL/min | `labs_subset` |

**Confidence:** 91% · **Source:** cross-table analysis

> **ACTION:** Flag for physician review before next dose. Consider holding Metformin immediately.

---

#### ⚠ HIGH · Furosemide with hyperkalemia — monitor closely

Furosemide is a loop diuretic typically causing potassium loss, yet patient potassium is already elevated. Underlying CKD may be counteracting expected diuretic effect.

| Data Point | Value | Source |
|------------|-------|--------|
| Prescription | Furosemide 40mg active | `prescriptions_subset` |
| Lab Result | K+ = 5.8 mEq/L (high) | `labs_subset` |

**Confidence:** 78% · **Source:** cross-table analysis

> **ACTION:** Repeat potassium in 4h. Reassess diuretic strategy with renal team.

---

## PT-0117 · Acute MI — Post PCI
**Age:** 54 · **Admit:** 23:47 · **Status:** 🟡 WATCH

---

### 01 · What Is Wrong

Patient admitted following acute myocardial infarction, status post percutaneous coronary intervention. Currently in monitored recovery phase. Hemodynamics stable but troponin trend requires close watch.

**Confidence:** 88% · **Source:** `clinical_cases + diagnoses_subset`

---

### 02 · What Has Been Tried

| Medication | Frequency | Confidence | Source |
|------------|-----------|------------|--------|
| Aspirin 81mg | QD | 98% | `prescriptions_subset` |
| Ticagrelor 90mg | BID | 96% | `prescriptions_subset` |
| Atorvastatin 80mg | QD | 93% | `prescriptions_subset` |
| Metoprolol 25mg | BID | 90% | `prescriptions_subset` |

---

### 03 · Watch Right Now

| Finding | Severity | Normal Range | Confidence | Source |
|---------|----------|--------------|------------|--------|
| Troponin I trending at 2.4 ng/mL | 🟠 High | <0.04 | 92% | `labs_subset` |
| LDL elevated at 168 mg/dL | 🟡 Medium | <100 | 85% | `labs_subset` |
| HR 52 bpm — bradycardic | 🟡 Medium | 60–100 | 88% | `labs_subset` |

---

### Contradiction Engine — PT-0117

#### ⚠ HIGH · Metoprolol with bradycardia — dose review

Beta-blocker Metoprolol is active while patient heart rate is 52 bpm, below the typical threshold for continuation. Risk of further rate depression.

| Data Point | Value | Source |
|------------|-------|--------|
| Prescription | Metoprolol 25mg BID active | `prescriptions_subset` |
| Lab Result | HR = 52 bpm | `labs_subset` |

**Confidence:** 82% · **Source:** cross-table analysis

> **ACTION:** Hold next Metoprolol dose pending cardiology review. Recheck HR in 1h.

---

## PT-0203 · Community-Acquired Pneumonia
**Age:** 41 · **Admit:** 01:03 · **Status:** 🟢 STABLE

---

### 01 · What Is Wrong

Patient presents with community-acquired pneumonia, right lower lobe consolidation confirmed on imaging. No ICU-level criteria met. Responding to initial antibiotic therapy.

**Confidence:** 91% · **Source:** `clinical_cases + diagnosis_dictionary`

---

### 02 · What Has Been Tried

| Medication | Frequency | Confidence | Source |
|------------|-----------|------------|--------|
| Azithromycin 500mg | QD | 97% | `prescriptions_subset` |
| Ceftriaxone 1g | QD IV | 94% | `prescriptions_subset` |

---

### 03 · Watch Right Now

| Finding | Severity | Normal Range | Confidence | Source |
|---------|----------|--------------|------------|--------|
| WBC elevated at 14.2 × 10³/μL | 🟡 Medium | 4.5–11.0 | 93% | `labs_subset` |
| CRP elevated at 88 mg/L | 🟡 Medium | <10 | 90% | `labs_subset` |
| O2 Sat 94% on room air | 🟢 Low | 95–100% | 87% | `labs_subset` |

---

### Contradiction Engine — PT-0203

✅ **No conflicts detected.** All cross-table checks passed.

---

## Uncertainty Log

All claims carry confidence scores. Items below 70% are suppressed and flagged as insufficient data. If a claim cannot be made with confidence, the system outputs an explicit uncertainty statement rather than hallucinating a result.

---

*Mock data — connect HuggingFace dataset to replace · Join key: `subject_id` + `hadm_id`*
