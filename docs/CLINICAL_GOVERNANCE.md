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

## Release And Incident Control

Clinical production releases require sign-off from the clinical owner, privacy/security, and operations. Disable or roll back recommendation features when validation, monitoring, or emergency escalation is unavailable. Preserve the governance version and correlation trail for incident review.
