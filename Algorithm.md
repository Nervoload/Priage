# Priage Queue Priority Algorithm

## Overview

The Priage queue priority algorithm determines the order patients should be seen in the emergency department waiting room. It balances **clinical urgency** (CTAS level) with **wait-time fairness** so that higher-acuity patients are always prioritized, while lower-acuity patients are never left waiting indefinitely.

The algorithm is implemented in [`Apps/HospitalApp/src/shared/queue/queuePriority.ts`](Apps/HospitalApp/src/shared/queue/queuePriority.ts).

---

## Inputs

The algorithm uses **two data points** from each patient encounter:

### 1. CTAS Level (Clinical Urgency)

The [Canadian Triage and Acuity Scale (CTAS)](https://caep.ca/resources/ctas/) assigns each patient a level from 1–5 based on clinical assessment:

| CTAS Level | Label          | Description                              |
|------------|----------------|------------------------------------------|
| 1          | Resuscitation  | Life-threatening, requires immediate care |
| 2          | Emergent       | Potential threat to life or limb          |
| 3          | Urgent         | Significant problem, needs timely care   |
| 4          | Less Urgent    | Minor condition, low risk                |
| 5          | Non-Urgent     | Can wait, minimal acuity                 |

### 2. Wait Time (Fairness)

How long the patient has been waiting, calculated from the earliest available timestamp:

```
waitingAt → triagedAt → arrivedAt → createdAt
```

The first non-null value is used as the wait start time.

---

## Algorithm

### Step 1: Assign Base Weight

Each CTAS level has a **base priority weight** and a **target wait time** (from CTAS clinical guidelines):

| CTAS | Base Weight | Target Wait Time |
|------|-------------|------------------|
| 1    | 100         | 0 min (immediate) |
| 2    | 80          | 15 min            |
| 3    | 60          | 30 min            |
| 4    | 40          | 60 min            |
| 5    | 20          | 120 min (2 hours) |
| None | 10          | 120 min           |

Higher weight = higher priority.

### Step 2: Calculate Wait Ratio

```
waitRatio = actualWaitMinutes / targetWaitMinutes
```

This tells us how far along (or past) the patient's target wait time they are:
- `waitRatio < 0.75` → **On Time** (comfortable buffer)
- `0.75 ≤ waitRatio < 1.0` → **Approaching** (getting close to target)
- `waitRatio ≥ 1.0` → **Overdue** (past their target time)

### Step 3: Calculate Escalation

Once a patient exceeds their target wait time, their priority score **escalates**:

```
escalation = max(0, waitRatio - 1.0) × ESCALATION_RATE
```

Where `ESCALATION_RATE = 15` points per full target period exceeded.

- Before target: escalation = 0 (score stays at base weight)
- At 2× target: escalation = 15 (one full period past due)
- At 3× target: escalation = 30 (two full periods past due)

### Step 4: Final Priority Score

```
Priority Score = Base Weight + Escalation
```

**Special case — CTAS 1 (Resuscitation):**
CTAS-1 patients have a target of 0 minutes (immediate). Their score is:
```
score = 100 + (waitMinutes × 0.5)
```
This ensures they are **always** at the top of the queue and their priority grows with every minute.

### Step 5: Sort & Tiebreak

Patients are sorted by **highest score first**. If two patients have scores within 0.5 points of each other, the patient who **arrived earlier** (FIFO) goes first.

---

## Example Scenario

Six patients are in the waiting room at the same time:

| # | Patient          | CTAS | Chief Complaint                           | Waited  |
|---|------------------|------|-------------------------------------------|---------|
| A | Maria Chen       | 1    | Chest pain radiating to left arm          | 5 min   |
| B | James Okafor     | 2    | Anaphylaxis after bee sting               | 20 min  |
| C | Emily Rodriguez  | 3    | Persistent worsening headache             | 45 min  |
| D | Sarah Thompson   | 3    | Severe abdominal pain                     | 10 min  |
| E | Ahmed Hassan     | 4    | Twisted ankle, can't bear weight          | 90 min  |
| F | David Kim        | 5    | Minor kitchen cut, bleeding controlled    | 30 min  |

### Score Calculations

**Patient A — Maria (CTAS 1, 5 min wait)**
```
score = 100 + (5 × 0.5) = 102.5
```
Always top priority.

**Patient B — James (CTAS 2, 20 min wait)**
```
waitRatio = 20 / 15 = 1.33  →  Overdue
escalation = (1.33 - 1.0) × 15 = 5.0
score = 80 + 5.0 = 85.0
```

**Patient C — Emily (CTAS 3, 45 min wait)**
```
waitRatio = 45 / 30 = 1.50  →  Overdue
escalation = (1.50 - 1.0) × 15 = 7.5
score = 60 + 7.5 = 67.5
```

**Patient D — Sarah (CTAS 3, 10 min wait)**
```
waitRatio = 10 / 30 = 0.33  →  On Time
escalation = max(0, 0.33 - 1.0) × 15 = 0
score = 60 + 0 = 60.0
```

**Patient E — Ahmed (CTAS 4, 90 min wait)**
```
waitRatio = 90 / 60 = 1.50  →  Overdue
escalation = (1.50 - 1.0) × 15 = 7.5
score = 40 + 7.5 = 47.5
```

**Patient F — David (CTAS 5, 30 min wait)**
```
waitRatio = 30 / 120 = 0.25  →  On Time
escalation = max(0, 0.25 - 1.0) × 15 = 0
score = 20 + 0 = 20.0
```

### Resulting Queue Order

| Queue # | Patient          | Score  | Status      |
|---------|------------------|--------|-------------|
| 1       | Maria Chen       | 102.5  | 🔴 Overdue   |
| 2       | James Okafor     | 85.0   | 🔴 Overdue   |
| 3       | Emily Rodriguez  | 67.5   | 🔴 Overdue   |
| 4       | Sarah Thompson   | 60.0   | ✅ On Time   |
| 5       | Ahmed Hassan     | 47.5   | 🔴 Overdue   |
| 6       | David Kim        | 20.0   | ✅ On Time   |

### Key Observation: Fairness in Action

Notice that **Emily (CTAS 3, 45 min)** jumped ahead of **Sarah (CTAS 3, 10 min)** even though they have the same CTAS level. Emily has been waiting 15 minutes past her 30-minute target, earning escalation points. Sarah just arrived and is well within her target — she can wait.

If **David (CTAS 5)** had been waiting for 8 hours (480 min) instead of 30 min:
```
waitRatio = 480 / 120 = 4.0
escalation = (4.0 - 1.0) × 15 = 45
score = 20 + 45 = 65.0
```
He would jump to position #4, ahead of fresh CTAS-3 Sarah (60.0) — because making a non-urgent patient wait 8 hours is not acceptable, even if higher-acuity patients keep arriving.

---

## Visual Indicators

Each patient card in the waiting room displays:

- **Queue Position Badge** — `#1`, `#2`, `#3` etc. in the top-left corner
- **Wait Status Pill** — color-coded indicator in the footer:
  - ✅ **On Time** (green) — under 75% of target time
  - ⚠️ **Approaching** (amber) — between 75%–100% of target time
  - 🔴 **Overdue** (red) — past target time
- **Left Border Color** — matches wait status (red/amber/default)

---

## Configuration

The following constants can be adjusted in `queuePriority.ts`:

| Constant         | Default | Description                                        |
|------------------|---------|----------------------------------------------------|
| `ESCALATION_RATE` | 15     | Points added per full target-time past due         |
| CTAS base weights | 100/80/60/40/20 | Starting priority per CTAS level          |
| CTAS targets     | 0/15/30/60/120 min | Target wait times per CTAS level          |
| On-time threshold | 75%   | Wait ratio below which status is "On Time"         |
| CTAS-1 growth    | 0.5/min | How fast CTAS-1 score grows (always top priority) |
