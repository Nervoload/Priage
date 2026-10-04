# Clinical Governance

## Intended Use

Priage recommendations are decision support, not diagnosis, triage assignment, or a substitute for emergency services. A nurse or doctor must review patient-reported and AI-derived information before it becomes trusted clinical information.

## Emergency Escalation

- Emergency warning signs produce an immediate instruction to call 911 when the patient may be in danger or cannot travel safely.
- The application must never imply that check-in, queue position, messaging, or an AI response is an acceptable reason to delay emergency care.
- Emergency escalation remains visible even if hospital admission, realtime delivery, storage, or recommendation generation fails.
- Emergency escalation behavior is tested before every clinical release and after any prompt, rule, model, localization, or UI change.

## Recommendation Governance

- Every recommendation includes a governance version, `decisionSupportOnly`, `humanReviewRequired`, and emergency-escalation state.
- Recommendation rules, prompts, models, thresholds, and translations require clinical-owner approval and a documented rollback plan.
- Patient text remains untrusted. AI summaries remain unreviewed until a clinician explicitly reviews them.
- Monitor under-triage, over-triage, emergency escalation, abandonment, and demographic/language performance. Review adverse events and near misses.

## Clinic Care Handoff

- Clinics never show, store or derive CTAS. Clinic urgency is Clear, Caution or Escalate, raised only by high-risk answers. See [Clinic Care handoff](CLINIC_CARE_HANDOFF.md).
- Handoff rules are versioned (`clinic-handoff-rules@N`) and every generated item records the rule that produced it. Rule wording, keyword lists and urgency thresholds need clinical-owner approval before the pilot and after any change.
- A future model may raise urgency above the rules' level, never lower it, and may only add items that cite the patient's recorded answers.
- Clinician feedback (Useful, Not right, Something missing) is stored per rule and generator version and reviewed by clinic admins in Analytics before any generator change ships.
- Each clinic's own questions are versioned and pinned to the interview that asked them. The safety question always comes first and can't be changed or removed.

## Release And Incident Control

Clinical production releases require sign-off from the clinical owner, privacy/security, and operations. Disable or roll back recommendation features when validation, monitoring, or emergency escalation is unavailable. Preserve the governance version and correlation trail for incident review.
