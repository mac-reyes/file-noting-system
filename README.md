# n8n Workflow Workspace

Public-safe workspace for developing and documenting one or more n8n Cloud/web workflows in an IDE.

Tracked files contain sanitized workflow JSON and workflow documentation. Private files contain raw n8n exports, local workflow IDs, credentials, and temporary output.

This repository is designed to be safe to publish after review, but the ignored private files on your machine are still sensitive. Publish from git, not by manually uploading the whole folder.

## Workflows

- `claims-assessment-legal-review` - main Microsoft Graph email intake, AI claim classification, and Google Sheets update workflow
- `microsoft-graph-mail-subscription-manager` - sub-workflow for Microsoft Graph mail subscription registration/renewal

Each workflow has:

```text
workflows/<slug>/workflow.json
workflows/<slug>/README.md
```

Raw exports are private and mirror the same slug:

```text
imports/raw/<slug>/export.json
```

## Setup

```sh
cp .env.example .env
```

Set your n8n API values in `.env`:

```env
N8N_BASE_URL=https://your-n8n-instance.example
N8N_API_KEY=your_api_key_here
```

Set workflow IDs in `.env` when you want `npm run get` to pull from n8n:

```env
WORKFLOW_CLAIMS_ASSESSMENT_LEGAL_REVIEW_ID=your_n8n_workflow_id
WORKFLOW_MICROSOFT_GRAPH_MAIL_SUBSCRIPTION_MANAGER_ID=your_n8n_workflow_id
```

You can also use an ignored local file for per-workflow overrides:

```text
workflows/<slug>/local.json
```

Example:

```json
{
  "workflowId": "source_workflow_id_for_get",
  "targetWorkflowId": "optional_existing_deploy_target_id"
}
```

## Commands

Pull a raw workflow export from n8n:

```sh
npm run get -- claims-assessment-legal-review
```

Sanitize raw export into tracked workflow JSON:

```sh
npm run sanitize -- claims-assessment-legal-review
```

Check all tracked workflows before committing:

```sh
npm run check
```

Deploy a tracked workflow as an inactive draft/update:

```sh
npm run deploy -- claims-assessment-legal-review
```

Show data table command help:

```sh
npm run datatables -- help
```

## Typical Flow

1. Pull or manually place raw export at `imports/raw/<slug>/export.json`.
2. Run `npm run sanitize -- <slug>`.
3. Review `workflows/<slug>/workflow.json` and `workflows/<slug>/README.md`.
4. Run `npm run check`.
5. Deploy with `npm run deploy -- <slug>` or import manually in n8n.
6. Reconnect/confirm credentials in n8n before activating.

## Adding A Workflow

1. Choose a slug, for example `new-workflow-name`.
2. Create `workflows/new-workflow-name/README.md`.
3. Add its workflow ID to `.env` or `workflows/new-workflow-name/local.json`.
4. Run:

```sh
npm run get -- new-workflow-name
npm run sanitize -- new-workflow-name
npm run check
```

## Private Files

These should not be committed:

```text
.env
imports/raw/**
credentials/checklist.md
workflows/**/local.json
tmp/**
```

Before publishing, verify git is ignoring them:

```sh
git status --short --ignored
```

Confirm that `.env`, `imports/raw/**`, `credentials/checklist.md`, and `workflows/**/local.json` are either untracked/ignored or absent.

## Credentials And Secrets

n8n Cloud/web workflow exports and the public API do not export decrypted credential secrets.

This project removes credential references from tracked workflow JSON. Real secrets must stay in:

- n8n credentials
- `.env`
- a password manager

Deployed workflows are kept inactive. Reconnect or confirm credentials in n8n before activation.

## Data Tables

```sh
npm run datatables -- help
npm run datatables -- list
```

`datatables list` uses n8n public API endpoints only. If your n8n plan/version does not expose data table endpoints publicly, the command fails clearly.

## Safety

Before pushing to GitHub:

```sh
npm run check
```

The checker fails if tracked workflow JSON contains credential blocks, auth-like fields, URLs, emails, resource IDs, webhook IDs, or secret-looking values.

Also review tracked workflow prompts and README files for non-secret business details, such as organization names, domains, internal process descriptions, or legal/commercial logic you do not want public.

Use only n8n public `/api/v1` endpoints. Do not automate private frontend `/rest` endpoints.
