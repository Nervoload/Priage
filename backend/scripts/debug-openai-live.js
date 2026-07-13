'use strict';

// Live diagnostic: replicates the exact request OpenAiTriageAdapter makes,
// so we can see the raw failure instead of the adapter's silent fallback.

const fs = require('node:fs');
const path = require('node:path');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
}

const {
  AI_TRIAGE_RESPONSE_JSON_SCHEMA,
  AI_TRIAGE_RESPONSE_SCHEMA_NAME,
} = require('../dist/modules/ai-triage/validation/ai-triage-response.schema');
const { AI_TRIAGE_SYSTEM_PROMPT, buildAiTriagePrompt } = require('../dist/modules/ai-triage/prompts/ai-triage.prompts');

async function main() {
  const model = process.env.AI_MODEL?.trim() || 'gpt-5-mini';
  console.log('Model:', model);
  console.log('Key present:', !!process.env.OPENAI_API_KEY?.trim(), '| length:', process.env.OPENAI_API_KEY?.trim().length);
  console.log('Timeout (env):', process.env.AI_TIMEOUT_MS);

  const prompt = buildAiTriagePrompt({
    patient: { age: 34, gender: 'female', chiefComplaint: 'Itchy red rash on both arms', details: null, allergies: null, conditions: null },
    mandatoryAnswers: { onset: 'Two days ago', severity: 4, progression: 'worse', relevantHistory: 'No known conditions' },
    answers: [],
    questionCount: 0,
    maxQuestions: 12,
    previousQuestions: [],
  });

  const started = Date.now();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
    },
    body: JSON.stringify({
      model,
      instructions: AI_TRIAGE_SYSTEM_PROMPT,
      input: prompt,
      max_output_tokens: 4000,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: AI_TRIAGE_RESPONSE_SCHEMA_NAME,
          strict: true,
          schema: AI_TRIAGE_RESPONSE_JSON_SCHEMA,
        },
      },
    }),
  });
  const elapsed = Date.now() - started;
  console.log('HTTP status:', response.status, '| elapsed ms:', elapsed);
  const body = await response.json();
  if (!response.ok) {
    console.log('ERROR BODY:', JSON.stringify(body, null, 2).slice(0, 2000));
    return;
  }
  console.log('response.status field:', body.status);
  console.log('incomplete_details:', JSON.stringify(body.incomplete_details));
  console.log('usage:', JSON.stringify(body.usage));
  const text = body.output_text
    || body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').find(Boolean)
    || '';
  console.log('output_text length:', text.length);
  console.log('output_text:', text.slice(0, 1500));
}

main().catch((error) => {
  console.error('FAILED:', error.message);
  process.exitCode = 1;
});
