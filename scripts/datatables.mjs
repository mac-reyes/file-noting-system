import { configureN8nApi, n8nRequest } from './helpers/n8n-api.mjs';

const [command = 'help'] = process.argv.slice(2);

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`Usage:
  npm run datatables -- help
  npm run datatables -- list

Notes:
  - Uses n8n public /api/v1 endpoints only.
  - Requires N8N_BASE_URL and N8N_API_KEY in .env for API-backed commands.
  - If your n8n plan/version does not expose data table API endpoints, the command fails clearly.`);
  process.exit(0);
}

if (command !== 'list') {
  console.error(`Unknown datatables command: ${command}`);
  console.error('Run `npm run datatables -- help`.');
  process.exit(1);
}

try {
  const api = configureN8nApi();
  const result = await n8nRequest(api, 'GET', '/data-tables');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Data table list failed.');
  console.error(error.message);
  console.error('Confirm your n8n plan/version exposes data table endpoints on the public API.');
  process.exit(1);
}
