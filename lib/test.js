// lib/test.js
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function test() {
  const scriptPath = path.resolve(
    __dirname,
    'k6/order.k6.js'
  );

  const args = [
    'run',
    '--summary-export', 'artifacts/k6-summary.json',
    scriptPath,
  ];

  const env = {
    ...process.env,
    BASE_URL: 'http://proxy.localhost',
  };

  console.log('🚀 Running k6 load test...');
  const child = spawn('k6', args, {
    stdio: 'inherit',
    env,
  });

  child.on('error', () => {
    console.error('❌ k6 not found. Install with: brew install k6');
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ k6 exited with code ${code}`);
      process.exit(code);
    }
    console.log('✅ k6 test finished');
  });
}
