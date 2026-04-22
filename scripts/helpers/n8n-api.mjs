import { loadDotEnv, requireEnv } from './env-utils.mjs';

export function configureN8nApi() {
  loadDotEnv();
  requireEnv(['N8N_BASE_URL', 'N8N_API_KEY']);

  return {
    baseUrl: process.env.N8N_BASE_URL.replace(/\/+$/, ''),
    apiKey: process.env.N8N_API_KEY,
  };
}

export async function n8nRequest(config, method, path, body) {
  const response = await fetch(`${config.baseUrl}/api/v1${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-N8N-API-KEY': config.apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = parsePayload(text);

  if (!response.ok) {
    const message = payload?.message || payload?.error || text || response.statusText;
    throw new Error(`${method} ${path} failed with ${response.status}: ${message}`);
  }

  return payload;
}

export function workflowEditorUrl(config, workflowId) {
  return `${config.baseUrl}/workflow/${workflowId}`;
}

function parsePayload(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
