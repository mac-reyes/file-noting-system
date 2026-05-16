import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = process.cwd();
const distDir = path.join(sourceRoot, 'dist');
const rootGsDir = path.join(sourceRoot, 'gs');
const featuresDir = path.join(sourceRoot, 'features');
const manifestPath = path.join(sourceRoot, 'appsscript.json');
const selectedFeatures = parseSelectedFeatures(process.argv.slice(2));
const copiedDistFiles = new Map();

function parseSelectedFeatures(argv) {
  const selected = [];

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];

    if (value === '--features') {
      selected.push(...splitFeatureList(argv[index + 1] || ''));
      index++;
      continue;
    }

    if (value.startsWith('--features=')) {
      selected.push(...splitFeatureList(value.slice('--features='.length)));
      continue;
    }

    throw new Error('Unsupported build argument "' + value + '".');
  }

  return Array.from(new Set(selected));
}

function splitFeatureList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

async function copyJsAsGs(sourceDir) {
  if (!(await pathExists(sourceDir))) {
    return;
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(distDir, fileName.replace(/\.js$/, '.gs'));
    await copyDistFile(sourcePath, targetPath);
  }
}

async function copyHtml(sourceDir) {
  if (!(await pathExists(sourceDir))) {
    return;
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(distDir, fileName);
    await copyDistFile(sourcePath, targetPath);
  }
}

async function buildFeature(featureName) {
  const featureRoot = path.join(featuresDir, featureName);
  await copyJsAsGs(path.join(featureRoot, 'gs'));
  await copyHtml(path.join(featureRoot, 'html'));
}

async function listAvailableFeatures() {
  const groups = (await readdir(featuresDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const features = [];
  for (const groupName of groups) {
    const groupDir = path.join(featuresDir, groupName);
    const groupFeatures = (await readdir(groupDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => groupName + '/' + entry.name)
      .sort();

    features.push(...groupFeatures);
  }

  return features;
}

function resolveFeatures(availableFeatures) {
  if (!selectedFeatures.length) {
    return availableFeatures;
  }

  const availableFeatureSet = new Set(availableFeatures);
  const unknownFeatures = selectedFeatures.filter((featureName) => !availableFeatureSet.has(featureName));
  if (unknownFeatures.length) {
    throw new Error(
      'Unknown feature(s): ' + unknownFeatures.join(', ') +
      '. Available features: ' + availableFeatures.join(', ')
    );
  }

  console.log('Building selected feature(s): ' + selectedFeatures.join(', '));
  return selectedFeatures.slice().sort();
}

function logCopy(sourcePath, targetPath) {
  console.log('copied ' + path.relative(sourceRoot, sourcePath) + ' -> ' + path.relative(sourceRoot, targetPath));
}

async function copyDistFile(sourcePath, targetPath) {
  const distName = path.basename(targetPath);
  const previousSource = copiedDistFiles.get(distName);
  if (previousSource) {
    throw new Error(
      'Duplicate dist output "' + distName + '" from ' +
      path.relative(sourceRoot, previousSource) + ' and ' +
      path.relative(sourceRoot, sourcePath) + '. Rename one source file before building.'
    );
  }

  copiedDistFiles.set(distName, sourcePath);
  await copyFile(sourcePath, targetPath);
  logCopy(sourcePath, targetPath);
}

async function main() {
  const features = resolveFeatures(await listAvailableFeatures());

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  copiedDistFiles.clear();

  await copyJsAsGs(rootGsDir);

  for (const featureName of features) {
    await buildFeature(featureName);
  }

  await copyDistFile(manifestPath, path.join(distDir, 'appsscript.json'));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
