import { readJson, findWorkflowFiles } from './helpers/workflow-utils.mjs';
import {
  findSensitiveValue,
  formatPath,
  isPlainObject,
  isSensitiveKey,
} from './helpers/sensitive-rules.mjs';

const workflowFiles = await findWorkflowFiles();
const findings = [];

for (const file of workflowFiles) {
  const workflow = await readJson(file);
  scanWorkflowRoot(workflow, file, findings);
  scanValue(workflow, [], file, findings);
}

if (workflowFiles.length === 0) {
  console.log('No workflow.json files found in workflows/');
  process.exit(0);
}

if (findings.length === 0) {
  console.log(`Checked ${workflowFiles.length} workflow file(s). No credential references or risky values found.`);
  process.exit(0);
}

console.error(`Checked ${workflowFiles.length} workflow file(s). Found ${findings.length} issue(s):`);
for (const finding of findings) {
  console.error(`- ${finding.file} ${finding.path}: ${finding.reason}`);
}

process.exit(1);

function scanWorkflowRoot(workflow, file, findings) {
  if (!isPlainObject(workflow)) return;

  if (workflow.active === true) {
    findings.push({ file, path: '$.active', reason: 'tracked workflow must be inactive' });
  }

  for (const key of ['id', 'versionId', 'meta']) {
    if (Object.hasOwn(workflow, key)) {
      findings.push({ file, path: formatPath([key]), reason: 'root n8n metadata should be removed' });
    }
  }
}

function scanValue(value, path, file, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, [...path, index], file, findings));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPath = [...path, key];

      if (key === 'credentials') {
        findings.push({ file, path: formatPath(nextPath), reason: 'credential reference block remains' });
        continue;
      }

      if (isSensitiveKey(key) && isUnsafeScalar(nestedValue)) {
        findings.push({ file, path: formatPath(nextPath), reason: `sensitive key "${key}" contains a value` });
      }

      scanValue(nestedValue, nextPath, file, findings);
    }

    return;
  }

  const sensitiveValue = findSensitiveValue(value, path);
  if (sensitiveValue) {
    findings.push({ file, path: formatPath(path), reason: `risky ${sensitiveValue.name}` });
  }
}

function isUnsafeScalar(value) {
  return typeof value === 'string' && value.trim() !== '' && value !== '[REDACTED]';
}
