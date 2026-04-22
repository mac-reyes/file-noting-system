export const REDACTION = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /(^|[_\-.])(credential|credentials|authorization|auth|api.?key|token|secret|password|passwd|pwd|client.?secret|access.?token|refresh.?token|bearer|cookie|private.?key|session|webhook.?id|webhook.?secret)([_\-.]|$)/i;

const SENSITIVE_VALUE_PATTERNS = [
  { name: 'authorization header', pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/i },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'api key', pattern: /\b(sk|pk|ghp|gho|github_pat|xox[baprs]|ya29|AIza)[A-Za-z0-9_\-]{12,}\b/i },
  { name: 'long secret-like value', pattern: /\b[A-Za-z0-9_\-]{32,}\b/ },
  { name: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: 'url', pattern: /\bhttps?:\/\/[^\s"'<>]+/i },
];

export function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERN.test(String(key));
}

export function findSensitiveValue(value, path = []) {
  if (typeof value !== 'string') return null;
  if (isStructuralInternalIdPath(path)) return null;

  return SENSITIVE_VALUE_PATTERNS.find(({ pattern }) => pattern.test(value)) ?? null;
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function formatPath(path) {
  if (path.length === 0) return '$';

  return path
    .map((part) => {
      if (typeof part === 'number') return `[${part}]`;
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part)) return `.${part}`;
      return `[${JSON.stringify(part)}]`;
    })
    .join('')
    .replace(/^\./, '$.');
}

function isStructuralInternalIdPath(path) {
  const last = path.at(-1);
  if (last !== 'id') return false;

  const [root, nodeIndex, ...rest] = path;
  if (root !== 'nodes' || typeof nodeIndex !== 'number') return false;

  if (rest.length === 1) return true;

  const joined = rest.join('.');
  return (
    joined.startsWith('parameters.conditions.conditions.') ||
    joined.startsWith('parameters.assignments.assignments.')
  );
}
