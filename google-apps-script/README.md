# Google Apps Script Projects

This folder contains separately deployable Apps Script projects.

## Dynamic CLI

From the repo root:

```bash
npm run apps-script -- list
npm run apps-script -- build --project legal-apps-suite
npm run apps-script -- build --project legal-apps-suite --features recoveries/legal-portal
npm run apps-script -- status --project legal-apps-suite
npm run apps-script -- push --project legal-apps-suite
```

Use grouped `--features` names for selected builds and pushes. Apps Script pushes
replace the remote project contents, so selected pushes deploy only the selected
grouped modules plus root files.

## Local Script ID Targets

Real Apps Script IDs should stay local and untracked.

1. Copy the example target file:

   ```bash
   cp google-apps-script/apps-script.targets.example.json google-apps-script/apps-script.targets.local.json
   ```

2. Replace the placeholder `scriptId` values with real Apps Script IDs.

3. List targets:

   ```bash
   npm run apps-script -- targets --project legal-apps-suite
   ```

4. Switch a project to a target:

   ```bash
   npm run apps-script -- switch --project legal-apps-suite --target recoveries_test
   ```

The switch command writes the selected project's local `.clasp.json` with:

```json
{
  "scriptId": "REAL_SCRIPT_ID",
  "rootDir": "dist"
}
```

Then `status` and `push` use that selected Script ID.

## Safety

- `apps-script.targets.local.json` is ignored by git.
- `.clasp.json` is ignored by git.
- The example target file contains placeholders only.
- `push` always requires a selected project and an existing local `.clasp.json`.
- `push` builds the requested full-suite or selected grouped feature scope before `clasp push`.
- Targeted `--features` pushes replace the remote project with only those grouped features.
