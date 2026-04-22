import {
  REDACTION,
  findSensitiveValue,
  formatPath,
  isPlainObject,
  isSensitiveKey,
} from './helpers/sensitive-rules.mjs';
import { readJson, workflowPaths, writeJson } from './helpers/workflow-utils.mjs';

const [slug] = process.argv.slice(2);

if (!slug) {
  console.error('Usage: npm run sanitize -- <workflow-slug>');
  process.exit(1);
}

const paths = workflowPaths(slug);
const rawWorkflow = await readJson(paths.rawExport).catch((error) => {
  if (error.code === 'ENOENT') {
    throw new Error(`Raw export not found: ${paths.rawExport}`);
  }
  throw error;
});

const report = {
  removedCredentials: [],
  removedMetadata: [],
  redactedValues: [],
};

const sanitized = sanitizeValue(rawWorkflow, [], report);
sanitizeWorkflowRoot(sanitized, report);
await writeJson(paths.workflow, sanitized);

console.log(`Sanitized workflow written to ${paths.workflow}`);
console.log(`Removed credential blocks: ${report.removedCredentials.length}`);
console.log(`Removed private metadata fields: ${report.removedMetadata.length}`);
console.log(`Redacted values: ${report.redactedValues.length}`);

if (report.removedCredentials.length > 0) {
  console.log('\nCredential blocks removed:');
  for (const item of report.removedCredentials) console.log(`- ${item}`);
}

if (report.redactedValues.length > 0) {
  console.log('\nValues redacted:');
  for (const item of report.redactedValues) console.log(`- ${item.path} (${item.reason})`);
}

if (report.removedMetadata.length > 0) {
  console.log('\nPrivate metadata removed:');
  for (const item of report.removedMetadata) console.log(`- ${item}`);
}

function sanitizeWorkflowRoot(workflow, report) {
  if (!isPlainObject(workflow)) return;

  workflow.active = false;
}

function sanitizeValue(value, path, report) {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, [...path, index], report));
  }

  if (isPlainObject(value)) {
    const next = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPath = [...path, key];

      if (path.length === 0 && ['id', 'versionId', 'meta'].includes(key)) {
        report.removedMetadata.push(formatPath(nextPath));
        continue;
      }

      if (key === 'credentials') {
        report.removedCredentials.push(formatPath(nextPath));
        continue;
      }

      if (isSensitiveKey(key) && isScalar(nestedValue)) {
        next[key] = REDACTION;
        report.redactedValues.push({ path: formatPath(nextPath), reason: `sensitive key "${key}"` });
        continue;
      }

      next[key] = sanitizeValue(nestedValue, nextPath, report);
    }

    return next;
  }

  const publicSafeValue = redactPublicBusinessHints(value, path, report);
  if (publicSafeValue !== value) return publicSafeValue;

  const sensitiveValue = findSensitiveValue(value, path);
  if (sensitiveValue) {
    report.redactedValues.push({ path: formatPath(path), reason: sensitiveValue.name });
    return REDACTION;
  }

  return value;
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function redactPublicBusinessHints(value, path, report) {
  if (typeof value !== 'string') return value;

  const redacted = value.replace(/(Firm Domain:\s*)[^\s@]+\.[^\s]+/gi, '$1example.com');
  if (redacted !== value) {
    report.redactedValues.push({ path: formatPath(path), reason: 'firm domain placeholder' });
  }

  return redacted;
}
