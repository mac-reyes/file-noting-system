# Microsoft Graph Mail Subscription Manager

## Purpose

Sub-workflow for managing Microsoft Graph mail subscriptions.

## Trigger / Source

- Trigger: Called by another n8n workflow
- Source system: Microsoft Graph

## Required Credentials

- Generic OAuth2 for `Graph: Renew1`
- Generic OAuth2 for `Graph: Register1`

Credential values stay in n8n, `.env`, or a password manager. They are not committed to this repository.

## Development Flow

1. Pull or place the raw workflow export at:

```text
imports/raw/microsoft-graph-mail-subscription-manager/export.json
```

2. Sanitize it into tracked workflow JSON:

```sh
npm run sanitize -- microsoft-graph-mail-subscription-manager
```

3. Review `workflow.json` and this README.
4. Run `npm run check`.
5. Deploy inactive draft/update with `npm run deploy -- microsoft-graph-mail-subscription-manager`.

## Manual Test Checklist

- [ ] Workflow imports into n8n web.
- [ ] OAuth credentials are reconnected.
- [ ] Subscription renewal path is tested.
- [ ] Subscription registration path is tested.
- [ ] Error path is checked.

## Notes

- Keep the deployed workflow inactive until Microsoft Graph OAuth credentials are reconnected.
- Verify renewal timing and callback/webhook settings in n8n after every import or API deploy.
- Raw Microsoft Graph subscription details belong only in ignored raw exports, `.env`, or n8n credentials.
