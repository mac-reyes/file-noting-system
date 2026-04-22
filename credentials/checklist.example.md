# Credential Checklist Example

Copy this file to `credentials/checklist.md` for local use. The copied file is ignored by git.

Do not include account names, emails, credential IDs, API keys, tokens, passwords, client secrets, or private URLs in tracked files.

## Required Credentials

- Service: Example service name
  - Used by node: Example node name
  - Credential type: OAuth2, API key, or service account
  - Environment variable names: EXAMPLE_CLIENT_ID, EXAMPLE_CLIENT_SECRET, EXAMPLE_API_KEY
  - Reconnect notes: Recreate/reconnect in n8n web before activating the workflow.

- Service: Example AI provider
  - Used by node: Example AI node name
  - Credential type: API key
  - Environment variable names: EXAMPLE_AI_API_KEY
  - Reconnect notes: Confirm the credential is selected in n8n after import or deploy.
