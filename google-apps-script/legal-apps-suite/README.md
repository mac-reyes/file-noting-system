# Legal Apps Suite

This project models the combined legal Apps Script workspace as feature modules while building one complete Apps Script payload.

## Source Layout

- `gs/`
  - root/shared Apps Script entry files, including `OpenDispatcher.js`
- `features/legal-portal/`
  - Legal Portal source under `gs/` and `html/`
- `features/document-generator/`
  - Document Generator source under `gs/`
- `features/repairer-sync/`
  - Repairer sync utilities under `gs/`
- `features/claim-statistics/`
  - Claim statistics analytics source under `gs/` and bundled modal HTML under `html/`
- `features/settlement-count/`
  - Settlement count analytics source under `gs/` and bundled modal HTML under `html/`
- `appsscript.json`
  - combined manifest

## Build

From this folder:

```bash
node build-dist.mjs
```

Build only selected feature modules:

```bash
node build-dist.mjs --features legal-portal
node build-dist.mjs --features legal-portal,document-generator
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
npm run apps-script -- push --project legal-apps-suite --features legal-portal,document-generator
```

Plain `push` builds and pushes the full suite. `push --features` builds and
pushes only the selected modules plus root `gs/` and `appsscript.json`.
Because `clasp push` replaces the remote Apps Script project contents, omitted
modules are removed from that TEST or production target.
