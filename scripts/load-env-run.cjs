const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = { ...process.env };

envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) return;
  const key = line.substring(0, eqIdx);
  let val = line.substring(eqIdx + 1);
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
});

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/load-env-run.cjs <script.ts>');
  process.exit(1);
}

console.log('Running:', script);
try {
  execSync(`npx tsx ${script}`, { env, stdio: 'inherit', timeout: 600000 });
} catch(e) {
  process.exit(e.status || 1);
}
