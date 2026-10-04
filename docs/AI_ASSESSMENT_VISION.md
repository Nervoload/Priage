# AI assessment: vision and principles

Status: agreed direction, 2026-10-04. Not built yet. What runs today is described in [the harness design](AI_ASSESSMENT_HARNESS.md#today).

This document says what the assessment model is for and the rules every design choice must keep. [The harness design](AI_ASSESSMENT_HARNESS.md) says how it works: the sequence, the model calls, the data formats and the round rules.

**For agents and new contributors.** Read this first. If a change would break a principle here, stop and raise it with the product owner instead of working around it. Items marked open in the harness design are the product owner's decisions, not defaults to pick.

## The job

When a patient starts a visit, before they book or reach a waiting room, the assessment asks them questions and builds their history. The goal is **the most complete, evidence-backed history the patient can give, in as few questions as possible.**

We ask the easy and obvious questions so the clinician can spend the visit on the subjective, complex and hands-on ones.

The clinician takes no part in the assessment. They receive its output in Care.

## What the clinic receives

- **The history.** Every fact the patient gave, in their own words and in clinical English, each tied to the answer it came from.
- **Possible causes.** A spread of them, each with a support level and the answers for and against it. Never a single conclusion.
- **What's still uncertain.** Vague answers, "not sure", contradictions, and anything not asked.
- **What to investigate.** Exams and tests that would settle a possible cause, limited to what this clinic can do on site.
- **Ask in the room.** Questions the clinician is better placed to ask.

## What the assessment does not do

- Tell the clinic what to do, or recommend treatment.
- Diagnose. Patients never see possible causes.
- Lower urgency. Rules set the floor; the model can only raise it.
- Treat a clinic visit as an emergency by default.

## Why information, not recommendations

1. A clinician who trusts Priage could be biased by a confident conclusion.
2. A conclusion can be checked. If it's wrong, the clinician dismisses it, and the history behind it goes with it.

A spread of possibilities, each backed by the patient's own answers, lets the clinician reach the conclusion and keeps their trust in the history.

## Principles

### 1. Build the history; leave the conclusion to the clinician

The output is information. Possible causes exist to choose better questions and to show the clinician what the history does and doesn't support. They are never presented as an answer.

### 2. Evidence, not percentages

Each possible cause has a support level, and each level lists the answers for and against it:

| Support level | Meaning |
|---|---|
| Leading | Several answers support it, and none argue strongly against it |
| Possible | Some answers support it |
| Less likely | Answers mostly argue against it |
| Not supported by history | Answers argue against it. For a dangerous cause the clinician sees "not supported by history, not excluded" |
| Not enough information | Too few relevant answers to say |

No probabilities or rankings. Numbers a model states don't match real probabilities and change between runs, and because causes can coexist, per-cause percentages don't combine into anything meaningful.

### 3. Stop at the askable limit

For each possible cause, keep asking only while a question **the patient can answer** could still shift it. Some question would always settle a cause, but past a point it needs an exam, a test or imaging, not the patient. A brain bleed is the extreme example. Once the next useful question needs an exam, a test or a clinician, stop asking about that cause and hand the question over as something to investigate.

The assessment ends when every possible cause has reached its askable limit and the core history is filled in or marked unknown, or when the question budget runs out.

### 4. Reason freely; audit afterwards

The model builds its possible causes without being handed warning-sign checklists, so it isn't pulled toward them. A hot, spreading purple patch on a leg fits both a flesh-eating infection and a bruise from a baseball; exploring both is how a proper history gets built.

Afterwards, code compares the model's list with a clinician-written list of dangerous causes for that complaint and adds any it missed. The audit is a safety net, not a script.

Counting textbook features is not evidence. Most people with a disease have only some of its classic features, and atypical presentations are exactly what a feature-count rule misses. Women and older adults having heart attacks without chest pain are the standard example.

### 5. Check for danger in proportion

Most clinic visits are not emergencies, and people usually know when they are in one. The fixed safety question always comes first. After that, a round dedicated to danger happens only when the case makes a dangerous cause possible.

Dangerous causes are never dropped. When the history doesn't support one, the clinician sees "not supported by history, not excluded" and what would settle it.

### 6. Code owns the sequence and safety; the model owns the content

This is not a choice between "model-led" and "rule-based". It's a dial set separately for each decision. Code decides:

- the order of rounds and the budget;
- emergency warnings;
- which proposed questions pass;
- when to stop.

The model:

- reasons about possible causes;
- writes and ranks questions;
- reads free-text answers;
- writes the handoff.

Clinician-reviewed knowledge feeds the model, and the model must still handle whatever the patient actually says.

### 7. Every claim points to an answer

Every fact, support level, consideration and handoff sentence cites the ids of the answers behind it. Code drops anything whose citations don't exist.

### 8. Constrain what the model returns, not how it thinks

Prompts stay short. The model reasons privately, in English. Only typed fields leave a call, and code checks them. Nothing from the model's private reasoning reaches a patient or a clinician.

### 9. Patients do their best; design for misunderstanding

Doing their best isn't the same as being accurate. So:

- "Not sure" is always available, and it's recorded as uncertainty, never as "no".
- Questions ask about concrete experiences ("Does it hurt more when you breathe in?") rather than descriptions ("Is it sharp?").
- A vague answer gets at most one gentle follow-up.
- Contradictions are shown to the clinician side by side, never quietly resolved.
- When someone answers for another person (a parent or caregiver), that's recorded, and the questions adapt.

### 10. Plain language, any language

Questions are simple, with one idea each. The model reasons and writes in English, and translation happens at the edges:

- the patient's free text is translated into English, and their original words are kept;
- questions are translated into the patient's language, preferring clinically reviewed translations;
- live translation is labelled as machine-translated for the clinician.

### 11. Fairness is tested, not assumed

We don't rely on prompt statements about bias. We design for fairness and test it:

- The model gets only what's clinically needed. No name, race, ethnicity or sexual orientation. Clinically relevant facts, such as whether pregnancy is possible, are asked directly rather than inferred.
- **Swap tests:** the same case with a different name, gender, dialect, typos or second-language writing must get the same urgency and the same coverage of dangerous causes.
- Misuse flags never lower urgency or block a patient. Garbled text may come from a communication difficulty. Flags go to staff for review.
- The handoff never describes the patient's character (no "anxious", "poor historian" or "drug-seeking").

### 12. The patient is never stuck

Every model call has a fallback. If a call is slow or fails, the patient gets the next reviewed question, and the assessment carries on.

### 13. Respect the patient's time

There are two budgets: **questions** (the patient's attention) and **model calls** (cost and speed). Spend calls to save questions. Related questions can share a screen.

## Three kinds of question that aren't asked

| Group | What it is | Who sees it |
|---|---|---|
| Not chosen | Proposed by the model but not picked | Stored for audit and testing only |
| Ask in the room | Better asked by the clinician: sensitive, chart-specific, or dependent on the exam | Clinician, in Care |
| Investigate | Exams and tests that would settle a possible cause | Clinician, in Care, limited to what the clinic can do on site |

## Who sees what

| Audience | Sees | Never sees |
|---|---|---|
| Patient | Questions, emergency warnings, and a summary of their own answers to confirm or correct before submitting | Possible causes, support levels, investigate items |
| Clinician | Everything under "What the clinic receives", labelled as generated, plus every answer | Percentages, a single conclusion, treatment recommendations |
| Reception | What the existing Care rules already allow | Possible causes |

## Rollout of possible causes to clinicians

1. **Hidden.** Generated, stored and scored, but not shown.
2. **On.** Shown as "considerations": no numbers, answers for and against, and dangerous causes labelled "not supported by history, not excluded" where that applies.
3. **Anything beyond that** only after a regulatory review against Health Canada's guidance on software as a medical device. Patients never see possible causes at any stage.

## Terms

| Term | Meaning |
|---|---|
| Assessment | The question-and-answer session a patient completes when starting a visit (the "interview" in code) |
| Case | The structured history one assessment builds: evidence, history elements, possible causes, gaps. Not a synonym for encounter; the [glossary](../GLOSSARY.md) still says to avoid "case" for an encounter |
| Evidence item | One fact taken from one answer, with the patient's words and the answer id |
| Possible cause | Something that could explain the complaint, with a support level and evidence for and against (`Candidate` in code) |
| Dangerous cause | A possible cause that can't be missed: life- or limb-threatening, or needing same-day care |
| Complaint type | A known kind of complaint ("sore throat", "urinary symptoms", "leg skin change") or "unclear" |
| Knowledge pack | Clinician-written material for one complaint type: dangerous causes, core history and reviewed question wording |
| Dangerous-cause audit | The code check that adds dangerous causes the model didn't consider |
| Round | A set of 2–4 questions planned together |
| Round type | A round's purpose: clarify, danger, distinguish or history |
| Askable limit | The point where no patient-answerable question can still shift a possible cause |
| Value test | A proposed question passes only if different answers would change the case differently |
| Filler question | A question that's useful whatever the earlier answers were, shown while the next round is planned |
| Ask in the room | A question left for the clinician to ask |
| Investigate | An exam or test that would settle a possible cause |
| Clinic capabilities | What a clinic can do on site (for example strep swab, urine dipstick, glucose, ECG) |
| Communication needs | Language, reading level, who is answering, and input preferences; needs, never diagnoses |
