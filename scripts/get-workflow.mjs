import { configureN8nApi, n8nRequest } from './helpers/n8n-api.mjs';
import { getWorkflowId, readLocalConfig, workflowIdEnvName, workflowPaths, writeJson } from './helpers/workflow-utils.mjs';

const [slug] = process.argv.slice(2);

if (!slug) {
  console.error('Usage: npm run get -- <workflow-slug>');
  process.exit(1);
}

try {
  const api = configureN8nApi();
  const localConfig = await readLocalConfig(slug);
  const workflowId = getWorkflowId(slug, localConfig);

  if (!workflowId) {
    throw new Error(
      `Missing workflow ID. Set workflows/${slug}/local.json with {"workflowId":"..."} or set ${workflowIdEnvName(slug)} in .env.`,
    );
  }

  const workflow = await n8nRequest(api, 'GET', `/workflows/${workflowId}`);
  const paths = workflowPaths(slug);
  await writeJson(paths.rawExport, workflow);

  console.log(`Fetched workflow ${workflowId} into ${paths.rawExport}`);
} catch (error) {
  console.error('Get failed.');
  console.error(error.message);
  process.exit(1);
}
