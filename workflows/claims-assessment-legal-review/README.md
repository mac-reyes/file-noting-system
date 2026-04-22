# Claims Assessment & Legal Review

## Purpose

Main workflow for processing Microsoft Graph mail notifications related to claims assessment and legal review. It receives Graph webhook notifications, fetches and normalizes email content, uses Gemini to classify the claim stage, cross-references matching records in Google Sheets, and updates the matched row with file notes and extracted metadata.

## Trigger / Source

- Trigger: Microsoft Graph webhook notification
- Source system: Microsoft Graph mail subscriptions
- Related sub-workflow: `microsoft-graph-mail-subscription-manager` manages subscription registration/renewal

The workflow also handles Microsoft Graph validation requests by echoing the validation token before processing normal notification payloads.

## Main Node Groups

- Webhook handling: `Graph: Webhook Receiver`, validation check, validation/token responses
- Email ingestion: notification splitting, email field normalization, Graph HTTP request
- AI extraction: structured JSON parser, Gemini main/fallback models, claim-stage classification
- Claim routing: settlement acceptance, offer stage, and F&R assessment checks
- Sheet lookup: reference expansion, sheet search loop, match detection, matched-record details
- Sheet update: merge AI notes/history and update the final Google Sheets record
- Review gate: wait node for legal verification where needed

## Required Credentials

- Generic OAuth2 for `HTTP Request`
- Google Sheets OAuth2 for:
  - `Final Google Sheets Update`
  - `Sheets: Cross-Reference Existing Records`
  - `Update row in sheet`
- Google Gemini / Google AI Studio API key for:
  - `Google Gemini Chat Model (Main)`
  - `Google Gemini Chat Model (Fallback)`

Credential values stay in n8n, `.env`, or a password manager. They are not committed to this repository.

## Development Flow

Pull latest raw workflow export:

```sh
npm run get -- claims-assessment-legal-review
```

Sanitize it into tracked workflow JSON:

```sh
npm run sanitize -- claims-assessment-legal-review
```

Review and validate:

```sh
npm run check
```

Deploy inactive draft/update:

```sh
npm run deploy -- claims-assessment-legal-review
```

## Manual Test Checklist

- [ ] Workflow imports into n8n web.
- [ ] Microsoft Graph OAuth credential is reconnected for the HTTP Request node.
- [ ] Google Sheets OAuth credential is reconnected for all Sheets nodes.
- [ ] Gemini API credential is reconnected for both model nodes.
- [ ] Graph validation request returns the validation token.
- [ ] Normal Graph notification is acknowledged quickly.
- [ ] Email details are fetched and normalized.
- [ ] AI output includes stage booleans, references, summary, file notes, and dates.
- [ ] Only one claim stage is true for a classified email.
- [ ] Reference expansion and Sheets lookup find the expected row.
- [ ] Final Google Sheets update writes to the intended row only.
- [ ] Wait/legal verification path behaves as expected.
- [ ] Error path from AI extraction or sheet lookup is reviewed.

## Notes

- Sanitized workflow JSON redacts Graph URLs, Google Sheets document IDs, webhook IDs, n8n instance metadata, and credential references.
- The workflow is expected to remain inactive after API deploy until credentials and webhook behavior are confirmed in n8n.
- The subscription manager sub-workflow should be kept in sync with this workflow's webhook URL expectations.
