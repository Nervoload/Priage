#!/usr/bin/env node
// Remove only the obsolete triage-reassessment repeat entry from the alerts queue.
require('dotenv').config();
const { Queue } = require('bullmq');

async function main() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379),
    db: Number(process.env.REDIS_DB || 0),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
  };
  const queue = new Queue('alerts', { connection });
  try {
    const repeatJobs = await queue.getRepeatableJobs();
    const obsolete = repeatJobs.filter((job) => job.name === 'triage-reassessment');
    const apply = process.argv.includes('--apply');
    for (const job of obsolete) {
      if (apply) await queue.removeRepeatableByKey(job.key);
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', keys: obsolete.map((job) => job.key), removed: apply ? obsolete.length : 0 }, null, 2));
  } finally { await queue.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
