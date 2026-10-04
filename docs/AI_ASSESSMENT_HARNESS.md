# AI assessment harness

Status: design, 2026-10-04. Not built. Read [the vision and principles](AI_ASSESSMENT_VISION.md) first; this document assumes them.

The harness is everything around the model that turns it into a safe assessment: the controller, the case it builds, the model calls, the checks on what comes back, fallbacks, logging and tests.

**For agents.** Field names and numbers here are drafts; confirm them when you build. Anything under [Open questions](#open-questions) belongs to the product owner, so raise it rather than deciding it. The engine's prompt for the emergency department (ED) must stay byte-identical, as [Clinic Care handoff](CLINIC_CARE_HANDOFF.md) requires.

## Scope

- **Clinics first.** The ED assessment keeps working as it does today.
- **Off, then shadow, then on.** Every model role starts off, runs hidden next to the rules (shadow), and is shown only after it beats the rules in testing and clinician feedback.
- **Production.** Production refuses any model provider until an approved Canadian provider is configured ([production-config.ts](../backend/src/common/config/production-config.ts)). Build and test with synthetic data in development.

## Today

| Piece | Today | In the harness |
|---|---|---|
| Interview controller, [triage-interview.service.ts](../backend/src/modules/intake/interview/triage-interview.service.ts) | Safety question first, then the clinic's questions (outside the budget). Up to 12 assessment questions (minimum 3), planned 3 at a time. Cached questions are replanned if an answer is vague. Emergency warning with acknowledgement. Rule-based fallback | Becomes the controller: rounds, round types, budget, stop rule |
| Provider, [triage-interview.provider.ts](../backend/src/modules/intake/interview/triage-interview.provider.ts) | One OpenAI Responses API call per batch returns questions, briefing, summary, urgency, red flags and a CTAS level. Strict JSON schema, `store: false`, 12 s timeout, and a second call to repair invalid JSON | Split into role calls behind a provider-neutral interface. On invalid output, fall back instead of making a repair call |
| Prompts, [prompts/](../backend/src/modules/intake/interview/prompts/) | Written for the ED, with CTAS cues | New clinic prompts, one per role. The ED prompt stays unchanged |
| Answer formats | `text`, `textarea`, `number`, `boolean`, `single_select` | Add multi-select, a scale with labelled ends, duration and a body map, with "Not sure" everywhere |
| Storage | Context items `ai_interview_state`, `ai_interview_answer`, `ai_triage_summary` | The case is stored per round ([open](#open-questions)) |
| Fallback bank, [rescue-question-bank.ts](../backend/src/modules/intake/interview/rescue-question-bank.ts) | Fixed questions by phase | Seeds the reviewed question wording and the filler questions |
| Care, [care-snapshot.ts](../backend/src/modules/clinic/care/care-snapshot.ts) and [clinic-handoff.rules.ts](../backend/src/modules/clinic/care/clinic-handoff.rules.ts) | Rule-based handoff. Empty `consider:N` and `exam:N` slots. Unasked candidate questions recorded. Clinician feedback stored per generator version | The writer fills the slots behind `CLINIC_HANDOFF_MODE` (`off` / `shadow` / `on`), which is planned but not built |

## Harness rules

1. **The model remembers nothing between calls.** The case lives in the database, and each call gets the parts it needs.
2. **Each call has one job,** a typed output and its own test cases.
3. **Code owns the sequence and the safety rules;** the model owns the content.
4. **Everything the model claims cites an answer id.**
5. **Every call has a fallback,** so a slow or broken model never stops the patient.

## Who decides what

| Decision | Who | How |
|---|---|---|
| Possible causes and their support levels | Model (interpreter) | Code checks citations and that each support level is consistent with its evidence |
| Whether dangerous causes were considered | Code, after the model | Dangerous-cause audit against the knowledge pack |
| The next round's type | Code | [Round type rules](#round-type-rules) |
| Question wording and answer format | Model (planner) | Code applies the [question checks](#question-checks) |
| Which questions are asked | Model proposes and ranks; code picks | [Choosing questions](#choosing-questions) |
| Reading yes/no, choice, scale and duration answers | Code | Mapped through the question's targets |
| Reading free-text answers | Model (reader) | The patient's original words are kept |
| Emergency warning | Code rules | The model can raise urgency, never lower it |
| When to stop | Both | The model reports its view; code applies the [stop rule](#stop-rule) |
| Handoff text | Model (writer) | Code drops any sentence without a valid citation |

## Sequence

```
START
 description + core facts ─┬─► patient answers: safety question, clinic questions,
                           │                    core-fact questions (code, no wait)
                           └─► Interpreter ─► code: checks, audit, round type
                                            ─► Planner ─► code: checks, pick 2–4
ROUND n
 patient answers round n
   · every answer          ─► emergency rules first
   · yes/no, choice, scale ─► code stores evidence against the question's targets
   · free text             ─► Reader ─► evidence in English, original kept
   · answer supports a dangerous cause ─► end the round early and replan
 last answer ─► filler question shown while:
        Interpreter ─► code: checks, audit, round type ─► Planner ─► code: checks, pick
 ─► round n+1 … until the stop rule is met
END
 Writer ─► code: citation check ─► Care snapshot (clinic_handoff item)
        ─► patient sees a summary of their answers to confirm or correct
```

**Hiding the wait.** The first calls start as soon as the description arrives and run while the patient answers the fixed questions. Between rounds, the patient answers a filler question (medications, allergies, what they've tried, how it affects their day) while the interpreter and planner run. Fillers are needed anyway, so no time is wasted.

**Timeouts.** If the calls miss their deadline, the controller asks the reviewed question for the most important open item and keeps waiting in the background. A late result is used for the next slot. The patient should never see an empty screen for more than a moment. Exact deadlines are [open](#open-questions).

## Model calls

| Call | When | Sees | Returns | Model |
|---|---|---|---|---|
| **Interpreter** | After the description, then after each round | Description, core facts, all evidence with answer ids, last round's case. **Not** the dangerous-cause list | Complaint types, history elements, possible causes with support levels and evidence, contradictions, an urgency signal | Strongest available |
| **Planner** | After the interpreter and the code checks | The case (including causes added by the audit), round type, questions already asked, remaining budget, communication needs, reviewed question wording, clinic capabilities | 6–8 proposed questions, best first, each stating what it's for | Strongest available |
| **Reader** | Each free-text answer | The question and the answer | Evidence in English, a vague flag, an optional follow-up question, contradictions, an integrity flag | Small, fast |
| **Writer** | Once, when the assessment completes | Final case, all answers, clinic capabilities | Briefing, summary, considerations, investigate items, ask-in-the-room items, all cited | Strong |

Each role sits behind one interface (typed input in, typed output out), with a driver per provider. Different roles can use different models.

**Guarding against anchoring.**
- The interpreter must answer "what else could explain this?" every round.
- In testing, the interpreter also runs once without last round's possible causes. A large difference between the two runs means it's stuck on its earlier list.
- The dangerous-cause audit adds what it missed. How often the audit adds something is tracked as a metric.

**Critic (optional).** A small model that checks the planner's questions for leading, confusing or double-barrelled wording. It runs hidden first, and joins the live path only if the planner breaks the rules often enough to matter.

## Formats

These are drafts. The shared types:

```ts
type AnswerId = string;            // a recorded answer
type CauseId = string;             // from the cause list, or `other:<slug>`
type HistoryElement =
  | 'onset' | 'location' | 'character' | 'radiation' | 'severity' | 'course'
  | 'better_worse' | 'associated_symptoms' | 'tried_so_far'
  | 'medications' | 'allergies' | 'conditions' | 'recent_events'
  | 'pregnancy_possible' | 'daily_impact';   // list needs clinical-owner review
type IntegrityFlag = 'ok' | 'nonsense' | 'off_topic' | 'instructions_in_answer';
```

### 1. Evidence item

One fact from one answer. Code creates it for structured answers, and the reader creates it for free text.

```ts
type EvidenceItem = {
  id: string;
  answerId: AnswerId;
  kind: 'reported' | 'denied' | 'not_sure' | 'vague';
  element?: HistoryElement;
  targets: (CauseId | HistoryElement)[];  // copied from the question that was asked
  value: string;                          // clinical English
  patientWords: string;                   // exactly as given
  language: string;                       // language the patient answered in
  answeredBy: 'patient' | 'parent' | 'caregiver' | 'other';
  source: 'structured' | 'reader';
};
```

Rules:
- Evidence is never edited or deleted. A correction from the patient becomes a new item that refers to the old one.
- "Not sure" is stored as `not_sure`, never as `denied`.

### 2. Possible cause

```ts
type Candidate = {
  id: CauseId;
  label: string;
  tier: 'cant_miss' | 'urgent' | 'routine';
  status: 'leading' | 'possible' | 'less_likely' | 'not_supported' | 'not_enough_information';
  for: AnswerId[];
  against: AnswerId[];
  askableNext: string[];                  // patient-answerable questions that could still shift it
  needsInPerson: {
    kind: 'exam' | 'test' | 'clinician_question';
    what: string;
    settles: string;
  }[];
  addedBy: 'model' | 'audit';
};
```

Code enforces:
- `leading` and `possible` need at least one id in `for`.
- `not_supported` needs at least one id in `against`.
- With neither, the status must be `not_enough_information`.
- Every cited id must exist.
- A `cant_miss` cause is never removed. If the interpreter leaves it out of its output, code keeps the previous entry and logs the omission for testing.
- A cause has reached its **askable limit** when `askableNext` is empty, or none of its proposed questions passes the value test.

### 3. Proposed question

```ts
type PlannedQuestion = {
  text: string;                           // English, plain language, one idea
  format: 'yes_no' | 'single' | 'multi' | 'scale' | 'duration' | 'body_map' | 'short_text' | 'long_text';
  choices?: string[];                     // code adds "Not sure" / "None of these"
  bankId?: string;                        // set when using reviewed wording
  purpose: 'clarify' | 'danger' | 'distinguish' | 'history';
  targets: (CauseId | HistoryElement)[];
  ifAnswered: {                           // what each answer would do to the case
    answer: string;
    effects: { target: CauseId | HistoryElement; shift: 'supports' | 'weakens' | 'fills' }[];
  }[];
  patientCanAnswer: 'yes' | 'partly';
  burden: 'low' | 'medium' | 'high';      // sensitive, long, or hard to understand
  betterInRoom?: string;                  // reason, if the clinician should ask it
  group?: string;                         // questions with the same group may share a screen
};
```

### Supporting formats

```ts
type Case = {
  assessmentId: string;
  version: number;                        // +1 per round
  complaints: { id: string; patientWords: string; characterized: boolean }[];
  evidence: EvidenceItem[];
  history: Partial<Record<HistoryElement, { status: 'filled' | 'unknown'; evidenceIds: string[] }>>;
  candidates: Candidate[];
  contradictions: { evidenceIds: string[]; note: string; clarified: boolean }[];
  askInRoom: { text: string; reason: string; answerIds: AnswerId[] }[];
  notChosen: PlannedQuestion[];           // audit and testing only
  urgency: { rules: 'clear' | 'caution' | 'escalate'; model?: 'caution' | 'escalate'; reasons: string[] };
  budget: { asked: number; max: number };
  communication: CommunicationNeeds;
  integrity: { flag: IntegrityFlag; answerId: AnswerId }[];
};

type CommunicationNeeds = {               // needs, never diagnoses
  language: string;
  readingLevel: 'simple' | 'standard';
  answeredBy: 'self' | 'parent' | 'caregiver' | 'other';
  subjectAge?: number;
  input: ('voice' | 'screen_reader' | 'large_text')[];
};

type ClinicCapabilities = {
  onSiteTests: string[];                  // e.g. strep swab, urine dipstick, glucose, ECG
  onSiteProcedures: string[];
};

type KnowledgePack = {                    // clinician-written, versioned, approved
  complaintType: string;
  version: string;
  approvedBy: string;
  dangerousCauses: { causeId: CauseId; ageBands?: string[]; screenBankIds: string[] }[];  // audit only
  coreHistory: HistoryElement[];
  bank: { id: string; text: string; format: PlannedQuestion['format']; choices?: string[];
          translations: Record<string, string>; reviewed: boolean }[];
};
```

Urgency uses the clinic levels from [Clinic Care handoff](CLINIC_CARE_HANDOFF.md): Clear, Caution and Escalate. The model's level can only raise the rules' level.

### Call outputs

```ts
type InterpreterOutput = {
  complaints: Case['complaints'];
  history: Case['history'];
  candidates: Candidate[];                // full list each round; code applies the guards above
  whatElse: string;                       // answer to "what else could explain this?"
  contradictions: Case['contradictions'];
  escalate: { level: 'none' | 'caution' | 'escalate'; reason: string; answerIds: AnswerId[] };
  integrity: IntegrityFlag;
};

type PlannerOutput = {
  questions: PlannedQuestion[];           // 6–8, best first
  done: { proposed: boolean; reason: string };
};

type ReaderOutput = {
  evidence: Pick<EvidenceItem, 'kind' | 'element' | 'value' | 'patientWords' | 'language'>[];
  vague: boolean;
  followUp?: string;                      // one gentle clarifying question, checked like any other
  contradicts: string[];                  // evidence ids this answer conflicts with
  integrity: IntegrityFlag;
};

type CitedSentence = { text: string; answerIds: AnswerId[] };

type WriterOutput = {
  briefing: CitedSentence[];
  summary: CitedSentence[];
  considerations: { causeId: CauseId; status: Candidate['status']; for: AnswerId[]; against: AnswerId[]; note: CitedSentence }[];
  investigate: { kind: 'exam' | 'test'; what: string; settles: CauseId[]; why: CitedSentence }[];
  askInRoom: { text: string; reason: string; answerIds: AnswerId[] }[];
};
```

The patient-reported history is a view over the evidence and history elements, so it has no output of its own. It comes from code and is never rewritten by a model.

## Round type rules

After each interpreter call, code applies these in order and uses the first that matches:

1. **Stop** if the [stop rule](#stop-rule) is met.
2. **Clarify** if any complaint isn't characterized yet: where it is (when that applies), when it started, what it feels like, how it's changing.
3. **Danger** if a dangerous cause is `possible` or `leading` and a question about it passes the value test.
4. **Distinguish** if any possible cause has a question that passes the value test.
5. **History** if core history elements are missing.
6. Otherwise, **stop**.

Within any round:
- 2–4 questions per round (the code uses 3 today).
- At most one question with a different purpose.
- At most one cheap danger-check question for a dangerous cause still at `not_enough_information`. This keeps danger checks in proportion without a dedicated danger round on every visit.
- Questions about a dangerous cause the case supports are shown on their own screen, never grouped.

Emergency warnings aren't a round. The emergency rules run on every answer and interrupt immediately.

## Choosing questions

The planner proposes 6–8 questions. Code then:

1. Drops any that fail the [question checks](#question-checks).
2. **Value test:** drops any whose `ifAnswered` entries all produce the same effects, because that question can't change the case.
3. **Ask in the room:** moves questions with `betterInRoom`, or with high burden on a sensitive topic, to the case's ask-in-the-room list.
4. Keeps the round's purpose, plus the one-off-purpose and one-danger-check allowances.
5. Orders what's left:
   1. a dangerous cause the case supports;
   2. the number of possible causes affected;
   3. missing core history;
   4. lower burden.
6. Takes the top 2–4. The rest go to `notChosen`.
7. If nothing passes, uses the reviewed question for the most important open item.

Comparing each question's `ifAnswered` prediction with the interpreter's actual change after the answer gives a consistency score for testing.

### Question checks

- One idea per question, in plain language, within a length and reading-level limit.
- No name of any cause in the case, or its synonyms. This stops the model's guesses leaking and avoids frightening the patient.
- No diagnosis, reassurance or treatment advice.
- Not a repeat of an asked question (same targets and same history element).
- An allowed format. `long_text` is used only for the opening description and the closing "anything else?".
- Code adds "Not sure" and "None of these" to choices, and supplies the labels for scale ends.
- Every target exists in the case, and `ifAnswered` covers every choice.

### Stop rule

Stop when any of these is true:

- **The case is done:** every possible cause has reached its askable limit, and the core history elements for the active complaint types are filled in or marked unknown.
- **The budget is spent.** Record the remaining open items as gaps.
- **The patient stops early.** Record the assessment as unfinished.

The safety question is always asked, and the existing minimum number of questions still applies. When a cause reaches its askable limit, its `needsInPerson` items become investigate or ask-in-the-room items. Tests are limited to the clinic's capabilities; anything else is shown as "not available on site".

## Handling answers

- **Emergency rules come first,** on every answer, before anything else.
- **Structured answers** (yes/no, choice, scale, duration, body map) need no model call. Code records evidence against the question's targets.
- **Free text** goes to the reader, which writes evidence in clinical English and keeps the original words. If the reader is late, the raw text is stored and the interpreter reads it at the end of the round.
- **"Not sure"** is recorded as uncertainty. For a dangerous cause it's asked once more in a different way. Otherwise it becomes an ask-in-the-room or investigate item.
- **Vague answers** get at most one follow-up per item, from the reader's `followUp` or a reviewed template.
- **Contradictions** get one clarifying question. If the answers still conflict, both go to the clinician side by side.
- **Ending a round early:** if an answer has a `supports` effect on a dangerous cause, the round ends and the next one is planned straight away.
- **Answering for someone else** is set at the start. Questions switch to "Does your child…" or "Does the person you're helping…", and the handoff says who answered.
- **Language:** questions are translated on the way out, with reviewed translations preferred. Free text is translated to English on the way in, with the original kept. Machine translation is labelled for the clinician.

## Handoff

- **When it runs:** the writer runs once, after the assessment completes and outside the interview lock. Its result is stored as a `clinic_handoff` context item behind `CLINIC_HANDOFF_MODE`, as planned in [Clinic Care handoff](CLINIC_CARE_HANDOFF.md#intended-model-use-future-pass).
- **Citations:** answer ids map to the snapshot's answer segment ids. Code drops any sentence or item that cites a missing segment.
- **Where each output appears in Care:**
  - considerations fill `consider:N`;
  - exams fill `exam:N` and `exam:N:why`;
  - ask-in-the-room items are added after the rules' own items;
  - gaps feed "Not established".
- **Tests need a slot:** Care has no place for tests yet. The exam section could become an "Investigate" section ([open](#open-questions)).
- **Labels:** everything the model writes keeps the existing "generated" label and voice styling.
- **Patient confirmation:** before submitting, the patient sees a plain-language summary of their own answers, never possible causes. A correction becomes a new evidence item, and the original is kept.

## Safety and integrity

- **Patient text is untrusted data.** It's delimited in every prompt, and the model has no tools and can take no actions.
- **Urgency:** the rules' urgency is the floor. The model can raise it with cited reasons, and the rules' red flags always show.
- **Misuse checks run in code first** (rate limits, bot checks). Model integrity flags only add a note for staff to review; they never lower urgency, block the patient or change questions.
- **What the model receives:** never name, race, ethnicity or sexual orientation.
- **The handoff never describes the patient's character.** The writer's instructions forbid it, and a word-list check backs that up.
- **Records:** every call logs the prompt version, model, latency, check rejections, and the source of each question shown (model, bank or fallback).

## Testing

**Replay set.** Synthetic and de-identified cases for each complaint type. Each case has:
- clinician-written dangerous causes that must be considered;
- items that must be asked;
- an ideal handoff;
- atypical presentations and swap variants.

**Scores for every prompt, model or rule change:**

| Measure | Target |
|---|---|
| Urgency below the rules' level | 0 |
| Handoff sentences without a valid citation | 0 |
| Swap-test differences in urgency or dangerous-cause coverage | 0 |
| Emergencies caught | All |
| Dangerous causes the audit had to add | Falling |
| Questions until a usable history | Falling |
| Repeated or leading questions | Near 0 |
| Predicted vs actual effect of answers | Rising |
| Stopped too early or too late (clinician review) | Falling |

**Live testing:**
- Shadow mode beside the current engine.
- Care feedback (Useful, Not right, Something missing) by generator version.
- Patient completion rate and time to complete.
- A version that does worse than the rules on any high-risk section doesn't ship (existing rule).

## Worked example

This is illustrative only and has not been clinically reviewed.

**Description:** "Growing purple spot on my leg, hot, spreading fast." The patient is 34, with no conditions and no medications.

**Round 0.** The interpreter, with no checklist, lists:
- bruise or blood collection under the skin;
- skin infection (cellulitis);
- flesh-eating infection (necrotising fasciitis), rated `possible`;
- blood clot in a leg vein (DVT);
- bite reaction;
- bleeding disorder.

The audit adds compartment syndrome from the leg-skin pack. Because the flesh-eating infection is `possible`, code chooses a danger round. The questions still separate the causes broadly:
- Any injury to the leg in the last week?
- Pain 0–10 (with labelled ends).
- Fever, chills or feeling faint? (multi-select)
- How fast is it spreading? (hours / about a day / several days / not sure)

**Answers:** hit by a baseball two days ago; pain 4; none; several days, and the colour is changing.

**Round 1.**
- Bruise is `leading`. For: injury, a single spot, colour change. Against: "hot", which is weak evidence.
- Cellulitis is `possible`.
- Flesh-eating infection and compartment syndrome are `not_supported` (shown as "not supported by history, not excluded").
- DVT is `less_likely`.

Code chooses a distinguish round:
- Is the skin broken anywhere?
- Is the whole lower leg swollen, or only around the spot?
- Has the redness spread past where you were hit?
- Do you take blood thinners? (history, asked in the same round)

**Answers:** no; only around the spot; not sure; no.

**Round 2.** No question passes the value test. What's left (warmth, firmness, the edge of the redness, a calf exam) needs a hands-on exam. **Stop.**

**Handoff:**
- **History,** with every fact cited.
- **Considerations:**
  - bruise: leading;
  - cellulitis: less likely;
  - three dangerous causes: not supported by history, not excluded.
- **Investigate:**
  - mark the edge of the redness and recheck it;
  - feel for a fluid pocket, or crackling under the skin;
  - examine the calf.
- **Tests:** none on site. An ultrasound only if the calf exam is abnormal, and it's not available at this clinic.
- **"Not sure" on spreading:** it became the "mark the edge" exam item rather than being asked again.

That's 8 assessment questions.

## Build order

1. **Formats and rules as code, with no model.** Types, the round type rules, question checks, value test, stop rule and the support-level checks, all as pure functions with unit tests.
2. **Knowledge packs.** The format, plus three high-volume clinic complaint types and "unclear", written with the clinical owner. Seed them from [rescue-question-bank.ts](../backend/src/modules/intake/interview/rescue-question-bank.ts) and the warning-sign groups in [clinic-handoff.rules.ts](../backend/src/modules/clinic/care/clinic-handoff.rules.ts).
3. **Offline prototype.** The interpreter and planner, run against 10–20 synthetic cases, with the clinical owner reviewing the output. No patient exposure.
4. **Replay set and scoring.**
5. **New answer formats in the patient app** ("Not sure", duration, labelled scales, body map). This is independent of the rest and improves the rule-based assessment straight away.
6. **Shadow mode beside the current engine,** in development and staging with synthetic data, and in production once a provider is approved.
7. **Writer to Care:** shadow first, then on.
8. **Model-led questioning on,** within the checks.

## Open questions

| Question | Notes |
|---|---|
| Hosting provider | Azure OpenAI in a Canadian region (a regional deployment, not Global or Data Zone), Claude through a cloud provider's Canadian region, or self-hosted open source |
| Languages after English | French is the likely first |
| Cause list | Our own list first, mapped later to ICD-10-CA or SNOMED CT? |
| Budgets and deadlines | Maximum questions, round size, call deadlines, and the longest acceptable wait on a screen |
| First complaint types | Which three, and the pack authoring and approval workflow |
| Clinic capabilities | Who fills them in, and where in Settings |
| Free writing vs reviewed wording | How much the planner may write new questions, and how new wording gets reviewed and translated |
| Critic in the live path | Decide from shadow data |
| Grouping questions | Which questions may share a screen |
| Storing the case | A new context item type, or an extension of `ai_interview_state` |
| Escalate alerts | Who receives them, and how Reception relays them under the clinic's protocol |
| Tests in Care | A new slot, or rename exam suggestions to "Investigate" |
| Communication needs | Which fields, and how the patient sets them |
| Integrity flags | What staff see, and where |
| Regulatory review | Confirm before considerations go from hidden to on |
