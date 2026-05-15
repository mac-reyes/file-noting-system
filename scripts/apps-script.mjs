import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'google-apps-script', 'apps-script.projects.json');
const targetsPath = path.join(projectRoot, 'google-apps-script', 'apps-script.targets.local.json');

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const config = await readProjectsConfig();

  if (!args.command || args.command === 'help' || args.help) {
    printHelp(config);
    return;
  }

  if (args.command === 'list') {
    listProjects(config);
    return;
  }

  if (!['build', 'push', 'pull', 'status', 'targets', 'switch', 'current'].includes(args.command)) {
    throw new Error('Unsupported Apps Script command "' + args.command + '". Use build, push, pull, status, targets, switch, current, or list.');
  }

  if (args.command === 'build' && !args.project) {
    if (args.features.length) {
      throw new Error('Command "build" with --features requires --project <name>.');
    }

    for (const project of config.projects) {
      await buildProject(config, project);
    }
    return;
  }

  if (!args.project) {
    throw new Error('Command "' + args.command + '" requires --project <name>.');
  }

  const project = getProject(config, args.project);

  if (args.command === 'targets') {
    const targetsConfig = await readTargetsConfig();
    listTargets(project, targetsConfig);
    return;
  }

  if (args.command === 'switch') {
    if (!args.target) {
      throw new Error('Command "switch" requires --target <alias>.');
    }

    const targetsConfig = await readTargetsConfig();
    await switchTarget(project, targetsConfig, args.target);
    return;
  }

  if (args.command === 'current') {
    const targetsConfig = await readTargetsConfig({ required: false });
    await showCurrentTarget(project, targetsConfig);
    return;
  }

  if (args.command === 'build') {
    await buildProject(config, project, { features: args.features });
    return;
  }

  if (args.features.length && args.command !== 'push') {
    throw new Error('Command "' + args.command + '" does not support --features. Use --features with build or push only.');
  }

  await assertClaspConfig(project);

  if (args.command === 'status') {
    await runClasp(project, ['status']);
    return;
  }

  if (args.command === 'pull') {
    await assertCleanWorktree();
    await runClasp(project, ['pull', '--force']);
    return;
  }

  if (args.features.length) {
    console.log(
      'Pushing selected feature(s): ' + args.features.join(', ') + '. ' +
      'The remote Apps Script project will be replaced with this selected build.'
    );
  }

  await buildProject(config, project, { features: args.features });
  await runClasp(project, ['push', '--force']);
}

function parseArgs(argv) {
  const args = {
    command: '',
    features: [],
    help: false,
    project: '',
    target: ''
  };

  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];

    if (!args.command && !value.startsWith('-')) {
      args.command = value;
      continue;
    }

    if (value === '--help' || value === '-h') {
      args.help = true;
      continue;
    }

    if (value === '--project') {
      args.project = argv[index + 1] || '';
      index++;
      continue;
    }

    if (value.startsWith('--project=')) {
      args.project = value.slice('--project='.length);
      continue;
    }

    if (value === '--features') {
      args.features = parseFeatureList(argv[index + 1] || '');
      index++;
      continue;
    }

    if (value.startsWith('--features=')) {
      args.features = parseFeatureList(value.slice('--features='.length));
      continue;
    }

    if (value === '--target') {
      args.target = argv[index + 1] || '';
      index++;
      continue;
    }

    if (value.startsWith('--target=')) {
      args.target = value.slice('--target='.length);
      continue;
    }

    throw new Error('Unsupported argument "' + value + '".');
  }

  return args;
}

function parseFeatureList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readProjectsConfig() {
  const rawConfig = await readFile(configPath, 'utf8');
  const config = JSON.parse(rawConfig);

  if (!Array.isArray(config.projects)) {
    throw new Error('Invalid Apps Script project config. Expected a top-level "projects" array in ' + path.relative(projectRoot, configPath) + '.');
  }

  return config;
}

function getProject(config, projectName) {
  const project = config.projects.find((item) => item.name === projectName);
  if (!project) {
    throw new Error(
      'Unknown Apps Script project "' + projectName + '". Available projects: ' +
      config.projects.map((item) => item.name).join(', ')
    );
  }

  return project;
}

function listProjects(config) {
  if (!config.projects.length) {
    console.log('No Apps Script projects are configured.');
    return;
  }

  config.projects.forEach((project) => {
    console.log(project.name + ' -> ' + project.sourceRoot);
  });
}

function printHelp(config) {
  console.log([
    'Usage:',
    '  npm run apps-script -- list',
    '  npm run apps-script -- build [--project <name>]',
    '  npm run apps-script -- build --project <name> --features <name>[,<name>]',
    '  npm run apps-script -- status --project <name>',
    '  npm run apps-script -- pull --project <name>',
    '  npm run apps-script -- push --project <name>',
    '  npm run apps-script -- push --project <name> --features <name>[,<name>]',
    '  npm run apps-script -- targets --project <name>',
    '  npm run apps-script -- switch --project <name> --target <alias>',
    '  npm run apps-script -- current --project <name>',
    '',
    'Available projects:',
    ...(config.projects.length ? config.projects.map((project) => '  - ' + project.name) : ['  (none configured)'])
  ].join('\n'));
}

async function readTargetsConfig({ required = true } = {}) {
  if (!(await pathExists(targetsPath))) {
    if (!required) {
      return {
        projects: {}
      };
    }

    throw new Error(
      'Missing local Apps Script target mapping: ' +
      path.relative(projectRoot, targetsPath) +
      '. Copy google-apps-script/apps-script.targets.example.json to apps-script.targets.local.json and add real Script IDs.'
    );
  }

  const rawConfig = await readFile(targetsPath, 'utf8');
  const config = JSON.parse(rawConfig);
  if (!config.projects || typeof config.projects !== 'object') {
    throw new Error('Invalid Apps Script target mapping. Expected a top-level "projects" object.');
  }

  return config;
}

function getProjectTargets(project, targetsConfig) {
  const projectConfig = targetsConfig.projects[project.name];
  const targets = projectConfig && projectConfig.targets;

  if (!targets || typeof targets !== 'object' || !Object.keys(targets).length) {
    throw new Error('No local Script ID targets configured for project "' + project.name + '".');
  }

  return targets;
}

function listTargets(project, targetsConfig) {
  const targets = getProjectTargets(project, targetsConfig);
  console.log('Targets for ' + project.name + ':');
  Object.keys(targets).sort().forEach((targetName) => {
    const target = targets[targetName] || {};
    const description = target.description ? ' - ' + target.description : '';
    console.log('  - ' + targetName + description);
  });
}

async function switchTarget(project, targetsConfig, targetName) {
  const targets = getProjectTargets(project, targetsConfig);
  const target = targets[targetName];
  if (!target) {
    throw new Error(
      'Unknown target "' + targetName + '" for project "' + project.name + '". Available targets: ' +
      Object.keys(targets).sort().join(', ')
    );
  }

  if (!target.scriptId) {
    throw new Error('Target "' + targetName + '" for project "' + project.name + '" is missing scriptId.');
  }

  const claspConfigPath = getClaspConfigPath(project);
  const claspConfig = {
    scriptId: target.scriptId,
    rootDir: 'dist'
  };

  await writeFile(claspConfigPath, `${JSON.stringify(claspConfig, null, 2)}\n`);
  console.log('Switched ' + project.name + ' to target "' + targetName + '".');
  console.log('Wrote ' + path.relative(projectRoot, claspConfigPath) + ' with rootDir "dist".');
}

async function showCurrentTarget(project, targetsConfig) {
  const claspConfigPath = getClaspConfigPath(project);
  if (!(await pathExists(claspConfigPath))) {
    throw new Error('No current clasp config found for project "' + project.name + '": ' + path.relative(projectRoot, claspConfigPath));
  }

  const rawConfig = await readFile(claspConfigPath, 'utf8');
  const claspConfig = JSON.parse(rawConfig);
  const matchingTargetName = findTargetNameByScriptId(project, targetsConfig, claspConfig.scriptId);

  console.log('Current target for ' + project.name + ':');
  console.log('  project folder: ' + project.sourceRoot);
  console.log('  target: ' + (matchingTargetName || '(unmapped)'));
  console.log('  rootDir: ' + (claspConfig.rootDir || '(not set)'));
}

function findTargetNameByScriptId(project, targetsConfig, scriptId) {
  if (!scriptId || !targetsConfig.projects) {
    return '';
  }

  const projectConfig = targetsConfig.projects[project.name];
  const targets = projectConfig && projectConfig.targets;
  if (!targets || typeof targets !== 'object') {
    return '';
  }

  return Object.keys(targets).find((targetName) => targets[targetName] && targets[targetName].scriptId === scriptId) || '';
}

async function buildProject(config, project, options = {}) {
  const sourceRoot = resolveProjectPath(project.sourceRoot);
  const distDir = resolveProjectPath(project.distDir);
  const buildContext = {
    ...project,
    sourceRoot,
    distDir
  };

  console.log('Building Apps Script project: ' + project.name);
  if (project.customBuild) {
    const buildArgs = [project.customBuild];
    if (options.features && options.features.length) {
      buildArgs.push('--features', options.features.join(','));
    }
    await runCommand('node', buildArgs, sourceRoot);
    return;
  }

  if (options.features && options.features.length) {
    throw new Error('Project "' + project.name + '" does not support --features targeted builds.');
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await copyServerFiles(buildContext);
  await copyHtmlFiles(buildContext);
  await writeManifest(config, buildContext);
}

async function copyServerFiles(project) {
  for (const filePath of project.gs || []) {
    const sourcePath = path.join(project.sourceRoot, filePath);
    const targetName = path.basename(filePath).replace(/\.js$/, '.gs');
    const targetPath = path.join(project.distDir, targetName);

    await copyFile(sourcePath, targetPath);
    logCopy(sourcePath, targetPath);
  }
}

async function copyHtmlFiles(project) {
  for (const filePath of project.html || []) {
    const sourcePath = path.join(project.sourceRoot, filePath);
    const targetPath = path.join(project.distDir, path.basename(filePath));

    await copyFile(sourcePath, targetPath);
    logCopy(sourcePath, targetPath);
  }
}

async function writeManifest(config, project) {
  const sourceManifest = project.manifest ? path.join(project.sourceRoot, project.manifest) : path.join(project.sourceRoot, 'appsscript.json');
  const distManifest = path.join(project.distDir, 'appsscript.json');

  if (await pathExists(sourceManifest)) {
    await copyFile(sourceManifest, distManifest);
    logCopy(sourceManifest, distManifest);
    return;
  }

  await writeFile(distManifest, `${JSON.stringify(config.defaultManifest, null, 2)}\n`);
  console.log('created ' + path.relative(projectRoot, distManifest));
}

async function assertClaspConfig(project) {
  const claspConfigPath = getClaspConfigPath(project);
  if (!(await pathExists(claspConfigPath))) {
    throw new Error(
      'Missing local clasp config for project "' + project.name + '": ' +
      path.relative(projectRoot, claspConfigPath)
    );
  }
}

async function assertCleanWorktree() {
  const status = await runCommandCapture('git', ['status', '--porcelain'], projectRoot);
  if (status.trim()) {
    throw new Error(
      'Cannot pull Apps Script while the git worktree has uncommitted changes. ' +
      'Commit or stash local changes first, then run pull again.'
    );
  }
}

function getClaspConfigPath(project) {
  return path.join(resolveProjectPath(project.sourceRoot), '.clasp.json');
}

async function runClasp(project, args) {
  const cwd = resolveProjectPath(project.sourceRoot);
  await runCommand('clasp', args, cwd);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(command + ' ' + args.join(' ') + ' exited with code ' + code + '.'));
    });
  });
}

function runCommandCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(
        command + ' ' + args.join(' ') + ' exited with code ' + code + '.' +
        (stderr ? '\n' + stderr.trim() : '')
      ));
    });
  });
}

function resolveProjectPath(filePath) {
  return path.resolve(projectRoot, filePath);
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

function logCopy(sourcePath, targetPath) {
  console.log('copied ' + path.relative(projectRoot, sourcePath) + ' -> ' + path.relative(projectRoot, targetPath));
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFilePath) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}
