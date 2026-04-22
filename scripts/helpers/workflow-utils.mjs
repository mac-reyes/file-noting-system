import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export const RAW_EXPORT_NAME = 'export.json';
export const WORKFLOW_NAME = 'workflow.json';

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function workflowPaths(slug) {
  return {
    rawExport: resolve('imports', 'raw', slug, RAW_EXPORT_NAME),
    workflow: resolve('workflows', slug, WORKFLOW_NAME),
    localConfig: resolve('workflows', slug, 'local.json'),
  };
}

export async function readLocalConfig(slug) {
  const paths = workflowPaths(slug);
  try {
    return await readJson(paths.localConfig);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function findWorkflowFiles(root = 'workflows') {
  return findFiles(resolve(root), (entry) => entry.isFile() && entry.name === WORKFLOW_NAME);
}

async function findFiles(dir, predicate) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });

  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(fullPath, predicate)));
    } else if (predicate(entry, fullPath)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

export function workflowIdEnvName(slug) {
  return `WORKFLOW_${slug.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()}_ID`;
}

export function getWorkflowId(slug, localConfig) {
  const envName = workflowIdEnvName(slug);
  return localConfig.workflowId || localConfig.targetWorkflowId || process.env[envName] || '';
}
