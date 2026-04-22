import { configureN8nApi, n8nRequest, workflowEditorUrl } from './helpers/n8n-api.mjs';
import { readJson, readLocalConfig, workflowPaths } from './helpers/workflow-utils.mjs';

const [slug] = process.argv.slice(2);

if (!slug) {
  console.error('Usage: npm run deploy -- <workflow-slug>');
  process.exit(1);
}

try {
  const api = configureN8nApi();
  const localConfig = await readLocalConfig(slug);
  const paths = workflowPaths(slug);
  const workflow = await readJson(paths.workflow).catch((error) => {
    if (error.code === 'ENOENT') throw new Error(`Workflow not found: ${paths.workflow}`);
    throw error;
  });

  const payload = prepareWorkflowForDeploy(workflow);
  const targetWorkflowId = localConfig.targetWorkflowId || localConfig.workflowId || '';
  const result = targetWorkflowId
    ? await n8nRequest(api, 'PUT', `/workflows/${targetWorkflowId}`, payload)
    : await n8nRequest(api, 'POST', '/workflows', payload);

  const workflowId = result?.id ?? result?.data?.id ?? targetWorkflowId;

  console.log(`Deployed ${slug} as an inactive workflow${targetWorkflowId ? ' update' : ' draft'}.`);
  if (workflowId) console.log(`Open in n8n: ${workflowEditorUrl(api, workflowId)}`);
  console.log('Reconnect/confirm credentials in n8n before activating.');
} catch (error) {
  console.error('Deploy failed.');
  console.error(error.message);
  console.error('No tracked workflow files were modified.');
  process.exit(1);
}

function prepareWorkflowForDeploy(workflow) {
  const payload = JSON.parse(JSON.stringify(workflow));
  payload.active = false;
  delete payload.id;
  delete payload.versionId;
  delete payload.meta;
  return payload;
}
