// backend/scripts/demo-seed.js
// ──────────────────────────────────────────────────────────────────────
// Creates a rich demo dataset (~25 patients) for hospital validation.
// Designed to populate the waiting-room grid, triage list, and admit
// views with realistic variety: different CTAS levels, vitals, chief
// complaints, message threads, and warning notes.
//
// Idempotent — safe to run multiple times.
//   First run:  creates everything
//   Subsequent: skips existing records
//
// Usage:
//   cd backend && node scripts/demo-seed.js
//
// Requires an existing target hospital. Pass --hospital-slug / --hospital-id
// or set TARGET_HOSPITAL_SLUG / TARGET_HOSPITAL_ID.
// ──────────────────────────────────────────────────────────────────────

require('dotenv').config();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { resolveHospitalActors, resolveTargetHospital } = require('./lib/seed-support');

const connectionString =
  process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function resolvePatientPassword() {
  const configured = process.env.DEMO_PATIENT_PASSWORD?.trim() || process.env.DEMO_STAFF_PASSWORD?.trim();
  return configured || `Priage-${randomUUID()}`;
}

const PATIENT_PASSWORD = resolvePatientPassword();

// ─── Helper to spread arrival times over the last few hours ─────────────────

function minutesAgo(min) {
  return new Date(Date.now() - min * 60_000);
}

// ─── Patient definitions ────────────────────────────────────────────────────
// Each patient has:
//   firstName, lastName, age, gender, phone
//   encounter: { status, chiefComplaint, details, minutesAgo }
//   triage (optional): { ctasLevel, priorityScore, painLevel, vitals, note }
//   healthInfo (optional): { warningNotes, allergies, conditions }
//   messages (optional): array of { sender, senderRole?, content }

const PATIENTS = [
  // ──── CTAS 1 — Resuscitation ────
  {
    firstName: 'Marcus', lastName: 'Williams', age: 58, gender: 'Male', phone: '555-1001',
    encounter: { status: 'WAITING', chiefComplaint: 'Cardiac arrest — ROSC achieved in ambulance', details: 'Patient had witnessed cardiac arrest at home. Paramedics administered 2 rounds of epinephrine. ROSC achieved after 8 minutes. GCS 6 on arrival.', minutesAgo: 12 },
    triage: { ctasLevel: 1, priorityScore: 99, painLevel: 0, vitals: { bloodPressure: '82/50', heartRate: 132, temperature: 35.8, respiratoryRate: 28, oxygenSaturation: 88 }, note: 'Post-ROSC. Intubated. Hypothermia protocol initiated. Cardiology and ICU alerted.' },
    healthInfo: { warningNotes: ['DNR status unknown — verify with family', 'History of coronary artery disease'], allergies: ['Amiodarone'], conditions: ['CAD', 'Previous MI (2021)', 'Hypertension'] },
    messages: [
      { sender: 'USER', senderRole: 'NURSE', content: 'Patient intubated, IV access x2 established. Continuous monitoring active.' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'Cardiology on the way. Prepare for possible cath lab transfer.' },
    ],
  },
  {
    firstName: 'Aisha', lastName: 'Khan', age: 34, gender: 'Female', phone: '555-1002',
    encounter: { status: 'TRIAGE', chiefComplaint: 'Anaphylaxis — bee sting, throat swelling', details: 'Known bee allergy. EpiPen administered by bystander before arrival. Still has stridor and facial swelling.', minutesAgo: 8 },
    triage: { ctasLevel: 1, priorityScore: 97, painLevel: 3, vitals: { bloodPressure: '90/55', heartRate: 124, temperature: 37.0, respiratoryRate: 26, oxygenSaturation: 91 }, note: 'Anaphylaxis post-epi. Second epi dose given. IV Benadryl and steroids administered. Monitoring for biphasic reaction.' },
    healthInfo: { warningNotes: ['Severe bee venom allergy — keep epinephrine at bedside'], allergies: ['Bee venom', 'Penicillin'], conditions: ['Asthma'] },
    messages: [
      { sender: 'PATIENT', content: 'My throat still feels tight and I\'m having trouble swallowing' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We\'ve given you a second dose of epinephrine. You\'re being closely monitored.' },
    ],
  },

  // ──── CTAS 2 — Emergent ────
  {
    firstName: 'Robert', lastName: 'Chen', age: 67, gender: 'Male', phone: '555-1003',
    encounter: { status: 'WAITING', chiefComplaint: 'Acute chest pain with ST-elevation on ECG', details: 'Sudden onset crushing chest pain 1 hour ago. Radiating to left jaw. Diaphoretic. ECG shows ST-elevation in leads II, III, aVF.', minutesAgo: 35 },
    triage: { ctasLevel: 2, priorityScore: 92, painLevel: 9, vitals: { bloodPressure: '158/96', heartRate: 104, temperature: 36.9, respiratoryRate: 22, oxygenSaturation: 94 }, note: 'STEMI protocol activated. ASA 325mg given. NTG sublingual x1. Morphine 4mg IV. Cath lab alerted — ETA 15 min.' },
    healthInfo: { warningNotes: ['Active STEMI — cath lab notified', 'Blood thinner — bleeding risk'], allergies: ['Sulfa drugs'], conditions: ['Type 2 Diabetes', 'Hyperlipidemia', 'Previous stent (2019)'] },
    messages: [
      { sender: 'PATIENT', content: 'The pain is crushing, like an elephant on my chest' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'We\'re activating the cardiac catheterization team. You\'ll be transferred shortly.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Pain medication administered. How is the chest pain now on a scale of 1-10?' },
    ],
  },
  {
    firstName: 'Priya', lastName: 'Sharma', age: 29, gender: 'Female', phone: '555-1004',
    encounter: { status: 'WAITING', chiefComplaint: 'Severe asthma exacerbation — not responding to home nebulizer', details: 'Known severe asthma. Used albuterol neb x3 at home without relief. Audible wheezing, speaking in single words.', minutesAgo: 45 },
    triage: { ctasLevel: 2, priorityScore: 88, painLevel: 4, vitals: { bloodPressure: '136/82', heartRate: 118, temperature: 37.2, respiratoryRate: 32, oxygenSaturation: 89 }, note: 'Severe exacerbation. Continuous neb started. IV magnesium given. RT at bedside. If no improvement — ICU consult.' },
    healthInfo: { warningNotes: ['Previous ICU admission for asthma (2023)', 'Steroid-dependent'], allergies: ['NSAIDs'], conditions: ['Severe persistent asthma', 'GERD'] },
    messages: [
      { sender: 'PATIENT', content: 'I can\'t...breathe...nebulizer...not helping' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We\'re giving you a stronger breathing treatment now. Try to stay calm and breathe slowly.' },
    ],
  },
  {
    firstName: 'James', lastName: 'O\'Brien', age: 45, gender: 'Male', phone: '555-1005',
    encounter: { status: 'TRIAGE', chiefComplaint: 'High-speed MVC — seat belt sign across abdomen', details: 'Restrained driver in T-bone collision at ~80 km/h. Complaining of severe abdominal pain. Visible seat belt bruise across lower abdomen.', minutesAgo: 18 },
    triage: { ctasLevel: 2, priorityScore: 90, painLevel: 8, vitals: { bloodPressure: '102/68', heartRate: 112, temperature: 36.5, respiratoryRate: 24, oxygenSaturation: 96 }, note: 'Trauma team activated. FAST scan positive — free fluid in Morrison\'s pouch. CT A/P ordered stat. 2 large bore IVs. Type and screen sent.' },
    healthInfo: { warningNotes: ['Trauma activation — possible internal bleeding'], allergies: [], conditions: [] },
    messages: [
      { sender: 'USER', senderRole: 'DOCTOR', content: 'We\'re getting you an urgent CT scan to check for internal injuries.' },
    ],
  },

  // ──── CTAS 3 — Urgent ────
  {
    firstName: 'Elena', lastName: 'Kowalski', age: 52, gender: 'Female', phone: '555-1006',
    encounter: { status: 'WAITING', chiefComplaint: 'Suspected kidney stones — severe right flank pain', details: 'Sudden onset right flank pain radiating to groin. Unable to find comfortable position. History of calcium oxalate stones. Positive for hematuria on dipstick.', minutesAgo: 62 },
    triage: { ctasLevel: 3, priorityScore: 70, painLevel: 9, vitals: { bloodPressure: '148/90', heartRate: 96, temperature: 37.3, respiratoryRate: 20, oxygenSaturation: 98 }, note: 'Renal colic presentation. Ketorolac 30mg IV and ondansetron given. CT KUB ordered. IV fluids running.' },
    healthInfo: { allergies: ['Codeine'], conditions: ['Recurrent nephrolithiasis', 'Hypertension'] },
    messages: [
      { sender: 'PATIENT', content: 'The pain comes in waves and it\'s unbearable when it peaks' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We\'ve given you pain medication through your IV. It should start working within 10-15 minutes.' },
    ],
  },
  {
    firstName: 'David', lastName: 'Nguyen', age: 75, gender: 'Male', phone: '555-1007',
    encounter: { status: 'WAITING', chiefComplaint: 'New onset confusion and fever — possible UTI/sepsis', details: 'Brought in by family. Normally alert and oriented. Today found confused, not recognizing family members. Fever 38.9°C at home. Recent UTI 2 weeks ago.', minutesAgo: 78 },
    triage: { ctasLevel: 3, priorityScore: 75, painLevel: 2, vitals: { bloodPressure: '98/64', heartRate: 102, temperature: 38.8, respiratoryRate: 22, oxygenSaturation: 95 }, note: 'Sepsis screen positive (qSOFA 2). Sepsis bundle initiated: cultures x2 drawn, lactate pending, broad-spectrum antibiotics started. CT head to r/o stroke.' },
    healthInfo: { warningNotes: ['Sepsis protocol activated', 'Fall risk — use bed alarm'], allergies: ['Ciprofloxacin', 'Latex'], conditions: ['BPH', 'Mild cognitive impairment', 'Recurrent UTIs', 'Atrial fibrillation'] },
    messages: [
      { sender: 'USER', senderRole: 'DOCTOR', content: 'We\'ve started antibiotics and are running tests to find the source of infection.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Family members can stay with the patient. Please let us know if he becomes more confused or agitated.' },
    ],
  },
  {
    firstName: 'Sophie', lastName: 'Dubois', age: 38, gender: 'Female', phone: '555-1008',
    encounter: { status: 'WAITING', chiefComplaint: 'Migraine with aura and unilateral weakness', details: 'Chronic migraine patient. This episode different — has right-sided arm weakness and word-finding difficulty along with typical visual aura. Onset 3 hours ago.', minutesAgo: 55 },
    triage: { ctasLevel: 3, priorityScore: 72, painLevel: 7, vitals: { bloodPressure: '132/80', heartRate: 78, temperature: 36.8, respiratoryRate: 16, oxygenSaturation: 99 }, note: 'Atypical migraine vs. stroke. Code stroke activated out of caution. CT head and CTA ordered. Neuro exam: 4+/5 right grip, mild expressive aphasia. NIHSS 4.' },
    healthInfo: { warningNotes: ['Code stroke — time-sensitive workup in progress'], allergies: [], conditions: ['Chronic migraines with aura', 'OCP use'] },
    messages: [
      { sender: 'PATIENT', content: 'My right hand feels heavy and I keep losing words' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'We\'re getting an urgent brain scan. This is precautionary given your symptoms.' },
    ],
  },
  {
    firstName: 'Hassan', lastName: 'Al-Rashid', age: 42, gender: 'Male', phone: '555-1009',
    encounter: { status: 'TRIAGE', chiefComplaint: 'Abdominal pain with nausea and vomiting x12hrs', details: 'Periumbilical pain migrating to RLQ over 12 hours. Anorexia, nausea, 2 episodes of emesis. Low-grade fever. Rebound tenderness on exam.', minutesAgo: 22 },
    triage: { ctasLevel: 3, priorityScore: 68, painLevel: 7, vitals: { bloodPressure: '126/78', heartRate: 92, temperature: 38.1, respiratoryRate: 18, oxygenSaturation: 99 }, note: 'Classic appendicitis presentation. Surgery consulted. NPO status. CT abdomen ordered to confirm. IV morphine for pain control.' },
    healthInfo: { allergies: ['Shellfish'], conditions: [] },
    messages: [
      { sender: 'PATIENT', content: 'The pain moved from around my belly button to the right side' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Please don\'t eat or drink anything for now. We\'re arranging a CT scan.' },
    ],
  },
  {
    firstName: 'Maria', lastName: 'Santos', age: 31, gender: 'Female', phone: '555-1010',
    encounter: { status: 'WAITING', chiefComplaint: 'Laceration to forehead — fell off bicycle', details: '4cm laceration above right eyebrow from bicycle fall onto pavement. No LOC. Alert and oriented. Wound actively oozing.', minutesAgo: 40 },
    triage: { ctasLevel: 3, priorityScore: 55, painLevel: 5, vitals: { bloodPressure: '118/72', heartRate: 82, temperature: 36.7, respiratoryRate: 16, oxygenSaturation: 99 }, note: 'Clean lac, no foreign bodies visible. Tetanus booster needed (last >10yr ago). Wound will need suturing (~6-8 stitches). No signs of head injury.' },
    healthInfo: { allergies: [], conditions: [] },
    messages: [
      { sender: 'PATIENT', content: 'Is the bleeding supposed to restart when I move my eyebrows?' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Yes, facial wounds bleed more due to blood supply. Keep the gauze pressed firmly. A doctor will suture it shortly.' },
    ],
  },

  // ──── CTAS 4 — Less Urgent ────
  {
    firstName: 'Thomas', lastName: 'Wilson', age: 55, gender: 'Male', phone: '555-1011',
    encounter: { status: 'WAITING', chiefComplaint: 'Persistent lower back pain for 3 days', details: 'Gradual onset lower back pain after lifting heavy boxes. No radiation. No saddle anesthesia or bladder issues. Taking ibuprofen with partial relief.', minutesAgo: 95 },
    triage: { ctasLevel: 4, priorityScore: 40, painLevel: 6, vitals: { bloodPressure: '134/84', heartRate: 76, temperature: 36.6, respiratoryRate: 16, oxygenSaturation: 99 }, note: 'Mechanical LBP. No red flags. X-ray lumbar spine ordered. Muscle relaxant and stronger analgesic to be prescribed.' },
    healthInfo: { allergies: ['Acetaminophen (liver reaction)'], conditions: ['Obesity', 'Prediabetes'] },
    messages: [],
  },
  {
    firstName: 'Lisa', lastName: 'Campbell', age: 24, gender: 'Female', phone: '555-1012',
    encounter: { status: 'WAITING', chiefComplaint: 'Twisted ankle — swelling and bruising', details: 'Rolled right ankle playing basketball. Unable to bear weight. Significant lateral swelling and ecchymosis. Ottawa rules positive — X-ray indicated.', minutesAgo: 70 },
    triage: { ctasLevel: 4, priorityScore: 35, painLevel: 5, vitals: { bloodPressure: '112/70', heartRate: 72, temperature: 36.5, respiratoryRate: 14, oxygenSaturation: 100 }, note: 'Likely lateral ankle sprain vs. avulsion fracture. X-ray right ankle ordered. Ice and elevation applied. Splint ready if fracture confirmed.' },
    healthInfo: { allergies: [], conditions: [] },
    messages: [
      { sender: 'PATIENT', content: 'It\'s really swollen now. Can I get some ice?' },
      { sender: 'USER', senderRole: 'STAFF', content: 'Ice pack has been applied. Keep your foot elevated on the pillow. X-ray tech will be with you soon.' },
    ],
  },
  {
    firstName: 'Ahmed', lastName: 'Ibrahim', age: 48, gender: 'Male', phone: '555-1013',
    encounter: { status: 'WAITING', chiefComplaint: 'Recurrent nosebleed — won\'t stop after 30 minutes', details: 'Third nosebleed this week. Current episode ongoing for 30+ minutes. On warfarin for A-fib. INR was 3.8 two days ago.', minutesAgo: 50 },
    triage: { ctasLevel: 4, priorityScore: 45, painLevel: 1, vitals: { bloodPressure: '142/88', heartRate: 84, temperature: 36.7, respiratoryRate: 16, oxygenSaturation: 98 }, note: 'Epistaxis with supratherapeutic INR likely. Anterior packing placed. Stat INR and CBC ordered. May need vitamin K if significantly elevated.' },
    healthInfo: { warningNotes: ['On warfarin — check INR before any procedures', 'Supratherapeutic INR (3.8) reported 2 days ago'], allergies: [], conditions: ['Atrial fibrillation', 'Hypertension'] },
    messages: [
      { sender: 'PATIENT', content: 'Blood keeps coming through the packing. This is scarier than usual.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'Keep your head tilted slightly forward. We\'re checking your blood-thinning levels now.' },
    ],
  },
  {
    firstName: 'Jennifer', lastName: 'Park', age: 33, gender: 'Female', phone: '555-1014',
    encounter: { status: 'TRIAGE', chiefComplaint: 'Rash spreading across trunk and arms — started yesterday', details: 'Diffuse maculopapular rash appeared on torso yesterday, now spreading to arms. Mildly pruritic. Started a new medication (amoxicillin) 5 days ago for strep throat.', minutesAgo: 15 },
    triage: { ctasLevel: 4, priorityScore: 38, painLevel: 1, vitals: { bloodPressure: '116/74', heartRate: 78, temperature: 37.0, respiratoryRate: 14, oxygenSaturation: 100 }, note: 'Drug eruption likely from amoxicillin. No mucosal involvement, no blistering (SJS unlikely). Amoxicillin discontinued. Antihistamine given.' },
    healthInfo: { warningNotes: ['Possible amoxicillin allergy — update allergy list'], allergies: ['Amoxicillin (new — under investigation)'], conditions: [] },
    messages: [],
  },

  // ──── CTAS 5 — Non-Urgent ────
  {
    firstName: 'Kevin', lastName: 'Brown', age: 27, gender: 'Male', phone: '555-1015',
    encounter: { status: 'WAITING', chiefComplaint: 'Prescription refill needed — ran out of blood pressure medication', details: 'Lost regular prescription. Needs refill for amlodipine 5mg. No acute symptoms. Last BP reading at pharmacy today was 138/86.', minutesAgo: 120 },
    triage: { ctasLevel: 5, priorityScore: 15, painLevel: 0, vitals: { bloodPressure: '140/88', heartRate: 72, temperature: 36.6, respiratoryRate: 14, oxygenSaturation: 99 }, note: 'Routine refill. Stable BPs. Counseled to establish primary care. 30-day Rx bridge to be provided.' },
    healthInfo: { allergies: [], conditions: ['Hypertension'] },
    messages: [],
  },
  {
    firstName: 'Rachel', lastName: 'Kim', age: 22, gender: 'Female', phone: '555-1016',
    encounter: { status: 'WAITING', chiefComplaint: 'Insect bite on leg — itchy and slightly red', details: 'Mosquito bite on left calf 2 days ago. Mildly red, itchy, no streaking or warmth. No fever. Just wants reassurance it\'s not infected.', minutesAgo: 105 },
    triage: { ctasLevel: 5, priorityScore: 10, painLevel: 1, vitals: { bloodPressure: '110/68', heartRate: 68, temperature: 36.5, respiratoryRate: 14, oxygenSaturation: 100 }, note: 'Benign insect bite reaction. No signs of cellulitis. OTC hydrocortisone cream and ice recommended. Patient education provided.' },
    healthInfo: { allergies: [], conditions: [] },
    messages: [
      { sender: 'PATIENT', content: 'Is this just a normal mosquito bite? It looks bigger than usual' },
      { sender: 'USER', senderRole: 'NURSE', content: 'It looks like a typical reaction. We see this often in summer. No signs of infection.' },
    ],
  },

  // ──── More EXPECTED and ADMITTED patients ────
  {
    firstName: 'Grace', lastName: 'Liu', age: 62, gender: 'Female', phone: '555-1017',
    encounter: { status: 'EXPECTED', chiefComplaint: 'Chest tightness and shortness of breath on exertion', details: 'Called ahead from home. Experiencing chest tightness when climbing stairs for past 2 days. Worsening today. Has history of angina.', minutesAgo: 5 },
    healthInfo: { warningNotes: ['Known angina — may need urgent cardiac workup'], allergies: ['Aspirin (GI bleed)'], conditions: ['Stable angina', 'GERD', 'Osteoporosis'] },
    messages: [],
  },
  {
    firstName: 'Daniel', lastName: 'Thompson', age: 8, gender: 'Male', phone: '555-1018',
    encounter: { status: 'EXPECTED', chiefComplaint: 'High fever (40.2°C) and lethargy — pediatric', details: 'Mother called. Child has had high fever for 2 days, not responding well to Tylenol. Increasingly lethargic today. No rash noted.', minutesAgo: 3 },
    healthInfo: { warningNotes: ['Pediatric patient — age 8'], allergies: [], conditions: [] },
    messages: [],
  },
  {
    firstName: 'Margaret', lastName: 'Foster', age: 83, gender: 'Female', phone: '555-1019',
    encounter: { status: 'ADMITTED', chiefComplaint: 'Mechanical fall — hip pain, unable to stand', details: 'Fell in bathroom this morning. Arrived by ambulance. Right leg externally rotated and shortened. Unable to ambulate.', minutesAgo: 25 },
    healthInfo: { warningNotes: ['Fall risk — use belt for transfers', 'On blood thinners (apixaban)'], allergies: ['Morphine (nausea)'], conditions: ['Osteoporosis', 'Atrial fibrillation', 'CKD Stage 3'] },
    messages: [
      { sender: 'PATIENT', content: 'Everything hurts when I try to move my right leg' },
      { sender: 'USER', senderRole: 'STAFF', content: 'We\'re getting you registered now. A nurse will be with you very shortly.' },
    ],
  },
  {
    firstName: 'Carlos', lastName: 'Rivera', age: 19, gender: 'Male', phone: '555-1020',
    encounter: { status: 'ADMITTED', chiefComplaint: 'Laceration to palm — glass injury', details: 'Cut hand on broken glass while doing dishes. Deep cut to palm of right hand. Active bleeding, unable to fully extend fingers.', minutesAgo: 20 },
    healthInfo: { allergies: [], conditions: [] },
    messages: [
      { sender: 'PATIENT', content: 'I can\'t move my pinky finger. Is that normal?' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We need to examine the wound more closely. Keep the towel wrapped tightly and hold your hand elevated.' },
    ],
  },

  // ──── Additional WAITING patients for grid variety ────
  {
    firstName: 'Fatima', lastName: 'Hassan', age: 44, gender: 'Female', phone: '555-1021',
    encounter: { status: 'WAITING', chiefComplaint: 'Diabetic — blood sugar over 400, feeling dizzy', details: 'Type 1 diabetic. Reports glucose meter reading of 420 mg/dL. Nausea, abdominal pain, and fruity breath odor noted. Drinking excessive water.', minutesAgo: 38 },
    triage: { ctasLevel: 2, priorityScore: 85, painLevel: 4, vitals: { bloodPressure: '106/70', heartRate: 108, temperature: 37.0, respiratoryRate: 24, oxygenSaturation: 97 }, note: 'DKA likely. ABG, BMP, ketones ordered stat. Insulin drip protocol initiated. 1L NS bolus running. Monitor K+ closely.' },
    healthInfo: { warningNotes: ['Type 1 Diabetic — DKA protocol', 'Check potassium before insulin bolus'], allergies: [], conditions: ['Type 1 Diabetes', 'Hypothyroidism'] },
    messages: [
      { sender: 'PATIENT', content: 'I feel really nauseous and my stomach hurts' },
      { sender: 'USER', senderRole: 'DOCTOR', content: 'Your blood sugar is very high. We\'re starting treatment to bring it down safely.' },
    ],
  },
  {
    firstName: 'William', lastName: 'Clark', age: 70, gender: 'Male', phone: '555-1022',
    encounter: { status: 'WAITING', chiefComplaint: 'Difficulty breathing — worsening over 3 days', details: 'Known COPD patient on home O2. Increased sputum production (yellow-green), worsening dyspnea for 3 days. Unable to complete sentences.', minutesAgo: 85 },
    triage: { ctasLevel: 3, priorityScore: 65, painLevel: 2, vitals: { bloodPressure: '146/92', heartRate: 98, temperature: 37.8, respiratoryRate: 26, oxygenSaturation: 88 }, note: 'COPD exacerbation with likely superimposed pneumonia. CXR ordered. Prednisone and azithromycin started. Duoneb q20min. On 3L NC — titrate to SpO2 88-92%.' },
    healthInfo: { warningNotes: ['COPD — do NOT over-oxygenate (target SpO2 88-92%)', 'Home oxygen user'], allergies: ['Erythromycin'], conditions: ['COPD Gold Stage III', 'CHF', 'Former smoker'] },
    messages: [
      { sender: 'PATIENT', content: 'I...can\'t...catch my breath...even sitting still' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We\'ve adjusted your oxygen and started breathing treatments. Try to relax your shoulders and breathe slowly.' },
    ],
  },
  {
    firstName: 'Sarah', lastName: 'Mitchell', age: 36, gender: 'Female', phone: '555-1023',
    encounter: { status: 'WAITING', chiefComplaint: 'Severe abdominal cramping and bloody diarrhea', details: 'Known Crohn\'s disease. Flare started 2 days ago with 8+ bloody BMs/day. Unable to keep fluids down. Appears dehydrated.', minutesAgo: 65 },
    triage: { ctasLevel: 3, priorityScore: 62, painLevel: 7, vitals: { bloodPressure: '100/62', heartRate: 106, temperature: 37.5, respiratoryRate: 18, oxygenSaturation: 98 }, note: 'Crohn\'s flare with volume depletion. 2L NS bolus. Labs: CBC, CMP, CRP, ESR, stool studies. GI on call notified. IV steroids started.' },
    healthInfo: { allergies: ['Metronidazole'], conditions: ['Crohn\'s disease', 'Iron deficiency anemia', 'Anxiety'] },
    messages: [
      { sender: 'PATIENT', content: 'This is the worst flare I\'ve ever had. I can\'t stop going to the bathroom.' },
      { sender: 'USER', senderRole: 'NURSE', content: 'We\'re giving you IV fluids and have contacted the GI specialist on call.' },
    ],
  },
  {
    firstName: 'Michael', lastName: 'Anderson', age: 60, gender: 'Male', phone: '555-1024',
    encounter: { status: 'WAITING', chiefComplaint: 'Sudden vision loss in right eye', details: 'Woke up with painless loss of vision in right eye 4 hours ago. Describes it as "curtain coming down." No eye pain, no headache.', minutesAgo: 48 },
    triage: { ctasLevel: 3, priorityScore: 73, painLevel: 0, vitals: { bloodPressure: '156/94', heartRate: 80, temperature: 36.8, respiratoryRate: 16, oxygenSaturation: 98 }, note: 'Retinal artery occlusion vs. retinal detachment. Ophthalmology STAT consult placed. Carotid ultrasound and echocardiogram ordered. Check ESR for GCA screen.' },
    healthInfo: { warningNotes: ['Time-sensitive eye emergency — ophthalmology consulted'], allergies: [], conditions: ['Hypertension', 'Hyperlipidemia'] },
    messages: [
      { sender: 'USER', senderRole: 'DOCTOR', content: 'An eye specialist is being called in urgently. Time is important for this type of vision loss.' },
    ],
  },
  {
    firstName: 'Emma', lastName: 'Taylor', age: 16, gender: 'Female', phone: '555-1025',
    encounter: { status: 'ADMITTED', chiefComplaint: 'Sports injury — possible concussion after soccer collision', details: 'Head-to-head collision during soccer game. Brief LOC per coach (~10 seconds). Confused for several minutes after. Complains of headache and nausea. Parents accompanying.', minutesAgo: 14 },
    healthInfo: { warningNotes: ['Pediatric — age 16', 'Brief LOC reported by witness', 'Previous concussion (2023)'], allergies: [], conditions: ['Previous concussion'] },
    messages: [
      { sender: 'PATIENT', content: 'My head is pounding and the lights are really bothering me' },
      { sender: 'USER', senderRole: 'STAFF', content: 'We\'ve dimmed the lights in your area. A doctor will assess you shortly.' },
    ],
  },
];

// ─── Main seed function ─────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Demo seed — creating ~25 patients for hospital demo…\n');

  const hashedPassword = await bcrypt.hash(PATIENT_PASSWORD, 10);
  const hospital = await resolveTargetHospital(prisma);
  const actors = await resolveHospitalActors(prisma, hospital.id);
  const createdUsers = {
    ADMIN: actors.adminUser,
    NURSE: actors.nurseUser,
    DOCTOR: actors.doctorUser,
    STAFF: actors.staffUser,
  };

  console.log(`🎯 Target hospital: ${hospital.name} (${hospital.slug})`);
  console.log(`   Using staff authors from ${actors.allUsers.length} existing user(s).`);

  // 1. Patients + encounters + triage + messages
  let created = 0;
  let skipped = 0;

  for (const p of PATIENTS) {
    const email = `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@patient.dev`;

    let patient = await prisma.patientProfile.findUnique({ where: { email } });
    if (!patient) {
      patient = await prisma.patientProfile.create({
        data: {
          email,
          password: hashedPassword,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
          age: p.age,
          gender: p.gender,
          allergies: p.healthInfo?.allergies?.join(', ') || null,
          conditions: p.healthInfo?.conditions?.join(', ') || null,
          optionalHealthInfo: p.healthInfo ? {
            warningNotes: p.healthInfo.warningNotes || [],
            allergies: p.healthInfo.allergies || [],
            conditions: p.healthInfo.conditions || [],
          } : null,
        },
      });
      console.log(`✅ Patient: ${p.firstName} ${p.lastName}`);
    } else {
      // Update optionalHealthInfo if missing
      if (!patient.optionalHealthInfo && p.healthInfo) {
        await prisma.patientProfile.update({
          where: { id: patient.id },
          data: {
            optionalHealthInfo: {
              warningNotes: p.healthInfo.warningNotes || [],
              allergies: p.healthInfo.allergies || [],
              conditions: p.healthInfo.conditions || [],
            },
          },
        });
      }
      console.log(`⏭️  Patient exists: ${p.firstName} ${p.lastName}`);
    }

    // Session token
    let existingSession = await prisma.patientSession.findFirst({
      where: {
        patientId: patient.id,
        encounterId: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Encounter
    if (!p.encounter) {
      if (!existingSession) {
        await prisma.patientSession.create({
          data: {
            token: randomUUID(),
            patientId: patient.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
      continue;
    }

    let encounter = await prisma.encounter.findFirst({
      where: { patientId: patient.id, hospitalId: hospital.id },
    });

    if (encounter) {
      skipped++;
      existingSession = await prisma.patientSession.findFirst({
        where: {
          patientId: patient.id,
          encounterId: encounter.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!existingSession) {
        await prisma.patientSession.create({
          data: {
            token: randomUUID(),
            patientId: patient.id,
            encounterId: encounter.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
      continue;
    }

    // Build timestamps
    const arrivalTime = minutesAgo(p.encounter.minutesAgo);
    const timestamps = { expectedAt: new Date(arrivalTime.getTime() - 10 * 60_000) };
    if (p.encounter.status !== 'EXPECTED') {
      timestamps.arrivedAt = arrivalTime;
    }
    if (['TRIAGE', 'WAITING'].includes(p.encounter.status)) {
      timestamps.triagedAt = new Date(arrivalTime.getTime() + 8 * 60_000);
    }
    if (p.encounter.status === 'WAITING') {
      timestamps.waitingAt = new Date(arrivalTime.getTime() + 15 * 60_000);
    }

    encounter = await prisma.encounter.create({
      data: {
        publicId: `enc_${randomUUID()}`,
        status: p.encounter.status,
        chiefComplaint: p.encounter.chiefComplaint,
        details: p.encounter.details,
        hospitalId: hospital.id,
        patientId: patient.id,
        createdAt: arrivalTime,
        ...timestamps,
      },
    });
    created++;

    // EncounterEvent
    await prisma.encounterEvent.create({
      data: {
        type: 'ENCOUNTER_CREATED',
        encounterId: encounter.id,
        hospitalId: hospital.id,
        metadata: { chiefComplaint: p.encounter.chiefComplaint, source: 'demo-seed' },
        processedAt: arrivalTime,
      },
    });

    // Triage assessment
    if (p.triage) {
      const nurseUser = createdUsers['NURSE'];
      const assessment = await prisma.triageAssessment.create({
        data: {
          ctasLevel: p.triage.ctasLevel,
          priorityScore: p.triage.priorityScore,
          chiefComplaint: p.encounter.chiefComplaint,
          painLevel: p.triage.painLevel,
          vitalSigns: p.triage.vitals,
          note: p.triage.note,
          createdByUserId: nurseUser.id,
          encounterId: encounter.id,
          hospitalId: hospital.id,
        },
      });

      await prisma.encounter.update({
        where: { id: encounter.id },
        data: {
          currentTriageId: assessment.id,
          currentCtasLevel: p.triage.ctasLevel,
          currentPriorityScore: p.triage.priorityScore,
        },
      });
    }

    // Messages
    if (p.messages && p.messages.length > 0) {
      for (const msg of p.messages) {
        const senderUser = msg.sender === 'USER'
          ? createdUsers[msg.senderRole || 'NURSE']
          : null;

        await prisma.message.create({
          data: {
            senderType: msg.sender,
            createdByPatientId: msg.sender === 'PATIENT' ? patient.id : null,
            createdByUserId: senderUser?.id ?? null,
            content: msg.content,
            encounterId: encounter.id,
            hospitalId: hospital.id,
            isInternal: false,
          },
        });
      }
    }

    // Patient session
    if (!existingSession) {
      await prisma.patientSession.create({
        data: {
          token: randomUUID(),
          patientId: patient.id,
          encounterId: encounter.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    console.log(
      `   ✅ Encounter #${encounter.id}: ${p.firstName} ${p.lastName} → ${p.encounter.status}` +
      (p.triage ? ` (CTAS ${p.triage.ctasLevel})` : '')
    );
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`🎉 Demo seed complete! Created ${created} encounters, skipped ${skipped} existing.\n`);
  console.log(`  Hospital:  ${hospital.name} (id=${hospital.id})`);
  console.log(`  Hospital slug: ${hospital.slug}`);
  console.log(`  Existing staff users at this hospital: ${actors.allUsers.length}`);
  for (const user of actors.allUsers) console.log(`    ${user.role.padEnd(6)}  ${user.email}`);
  console.log(`  Patient demo password: ${PATIENT_PASSWORD}\n`);
  console.log(`\n  Patients: ${PATIENTS.length} total`);

  const statusCounts = {};
  const ctasCounts = {};
  for (const p of PATIENTS) {
    if (!p.encounter) continue;
    statusCounts[p.encounter.status] = (statusCounts[p.encounter.status] || 0) + 1;
    if (p.triage) ctasCounts[p.triage.ctasLevel] = (ctasCounts[p.triage.ctasLevel] || 0) + 1;
  }

  console.log('  By status:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status.padEnd(10)} ${count}`);
  }
  console.log('  By CTAS:');
  for (const [level, count] of Object.entries(ctasCounts).sort((a, b) => a[0] - b[0])) {
    console.log(`    CTAS ${level}      ${count}`);
  }
  console.log('─'.repeat(60) + '\n');
}

seed()
  .catch((err) => {
    console.error('❌ Demo seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
