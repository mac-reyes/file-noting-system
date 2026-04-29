import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'google-apps-script', 'legal-review-portal');
const gsSourceDir = path.join(sourceRoot, 'gs');
const htmlSourceDir = path.join(sourceRoot, 'html');
const distDir = path.join(sourceRoot, 'dist');
const sourceManifest = path.join(sourceRoot, 'appsscript.json');
const distManifest = path.join(distDir, 'appsscript.json');

const defaultManifest = {
  timeZone: 'Australia/Sydney',
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8'
};

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

async function copyServerFiles() {
  const entries = await readdir(gsSourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const sourcePath = path.join(gsSourceDir, fileName);
    const targetName = fileName.replace(/\.js$/, '.gs');
    const targetPath = path.join(distDir, targetName);
    await copyFile(sourcePath, targetPath);
    console.log(`copied ${path.relative(projectRoot, sourcePath)} -> ${path.relative(projectRoot, targetPath)}`);
  }
}

async function copyHtmlFiles() {
  const entries = await readdir(htmlSourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const sourcePath = path.join(htmlSourceDir, fileName);
    const targetPath = path.join(distDir, fileName);
    await copyFile(sourcePath, targetPath);
    console.log(`copied ${path.relative(projectRoot, sourcePath)} -> ${path.relative(projectRoot, targetPath)}`);
  }
}

async function writeManifest() {
  if (await pathExists(sourceManifest)) {
    await copyFile(sourceManifest, distManifest);
    console.log(`copied ${path.relative(projectRoot, sourceManifest)} -> ${path.relative(projectRoot, distManifest)}`);
    return;
  }

  await writeFile(distManifest, `${JSON.stringify(defaultManifest, null, 2)}\n`);
  console.log(`created ${path.relative(projectRoot, distManifest)}`);
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await copyServerFiles();
  await copyHtmlFiles();
  await writeManifest();
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
