# Legal Apps Suite

This project models the combined legal Apps Script workspace as feature modules while building one complete Apps Script payload.

## Source Layout

- `gs/`
  - root/shared Apps Script entry files, including `OpenDispatcher.js`
- `features/recoveries/legal-portal/`
  - Legal Portal source under `gs/` and `html/`
- `features/recoveries/recovery-document-generator/`
  - Recoveries document generator source under `gs/`
- `features/recoveries/repairer-sync/`
  - Repairer sync utilities under `gs/`
- `features/recoveries/claim-statistics/`
  - Claim statistics analytics source under `gs/` and bundled modal HTML under `html/`
- `features/money-talks/settlement-count/`
  - Settlement count analytics source under `gs/` and bundled modal HTML under `html/`
- `features/money-talks/settlement-release-generator/`
  - Money Talks settlement release generator source under `gs/`
- `features/money-talks/counter-buttons/`
  - Money Talks assigned-button counter helpers under `gs/Code.js`, which builds to `Code.gs`
- `appsscript.json`
  - combined manifest

## Build

From this folder:

```bash
node build-dist.mjs
```

Build only selected feature modules:

```bash
node build-dist.mjs --features recoveries/legal-portal
node build-dist.mjs --features recoveries/recovery-document-generator,money-talks/settlement-release-generator
```

The build writes one combined payload to:

```text
dist/
```

Partial builds always include root `gs/` and `appsscript.json`, but only the
selected feature folders.

## Push

The repo wrapper pushes exactly the build scope you request:

```bash
npm run apps-script -- push --project legal-apps-suite
npm run apps-script -- push --project legal-apps-suite --features recoveries/legal-portal,money-talks/settlement-count
```

Plain `push` builds and pushes the full suite. `push --features` builds and
pushes only the selected modules plus root `gs/` and `appsscript.json`.
Because `clasp push` replaces the remote Apps Script project contents, omitted
modules are removed from the selected domain target, such as `recoveries_test`,
`recoveries_prod`, `money_talks_test`, or `money_talks_prod`.
