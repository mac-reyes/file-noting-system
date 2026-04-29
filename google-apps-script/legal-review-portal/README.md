# Legal Review Portal (Google Apps Script)

## Purpose

This folder contains the local source copy of the Google Apps Script legal review portal.

For now, the files here are copied manually into a Google Apps Script project that is bound to your target Google Sheet. This repository copy is the version you edit and keep under source control before pasting updates into Google Apps Script.

## Current Implementation Status

This repo contains the current Google Apps Script source and UI for the legal review portal.

Before using it in a real workbook, confirm and update:

- fixed standard-tab column numbers in `gs/ReviewRepository.js`
- exact tab names if they differ from the defaults
- the `Calendar Events` tab exists with the required fixed columns
- pending-review rows and callback URLs are present in the workbook

Repo layout:

```text
google-apps-script/legal-review-portal/
  README.md
  gs/
    WaitNode.js
    ClaimStatistics.js
    ReviewRepository.js
    ReviewMappers.js
  html/
    SidebarUI.html
    ApprovalModal.html
    ClaimStatsModal.html
    ClaimStatsDiagnosticsModal.html
```

## Files To Create In Google Apps Script

Create these files in the Apps Script editor with the same names:

- `WaitNode.gs`
- `ClaimStatistics.gs`
- `ReviewRepository.gs`
- `ReviewMappers.gs`
- `SidebarUI.html`
- `ApprovalModal.html`
- `ClaimStatsModal.html`
- `ClaimStatsDiagnosticsModal.html`

In this repo, the server-side Apps Script source is stored as `.js` files under `gs/` for readability, and the UI templates are stored under `html/`.
When you copy these into Google Apps Script, create them there as `.gs` files with the matching base names.

## Manual Setup In Google Sheets

1. Open the target Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Create or open the bound Apps Script project for that sheet.
4. Rename the Apps Script project to something clear, such as `Legal Review Portal`.
5. Remove the default placeholder code if you do not need it.
6. Add new script files named `WaitNode.gs`, `ClaimStatistics.gs`, `ReviewRepository.gs`, and `ReviewMappers.gs`.
7. Add new HTML files named `SidebarUI.html`, `ApprovalModal.html`, `ClaimStatsModal.html`, and `ClaimStatsDiagnosticsModal.html`.
8. Open each matching file in this repo and copy its contents into the Apps Script editor:
   - `gs/WaitNode.js` into `WaitNode.gs`
   - `gs/ClaimStatistics.js` into `ClaimStatistics.gs`
   - `gs/ReviewRepository.js` into `ReviewRepository.gs`
   - `gs/ReviewMappers.js` into `ReviewMappers.gs`
   - `html/SidebarUI.html`
   - `html/ApprovalModal.html`
   - `html/ClaimStatsModal.html`
   - `html/ClaimStatsDiagnosticsModal.html`
9. Save the Apps Script project.

## Manual Update Existing Apps Script Files

If the bound Apps Script project already exists and you want to update it manually:

1. Open the target Google Sheet.
2. Go to `Extensions > Apps Script`.
3. Open the existing Apps Script project bound to that sheet.
4. For each file below, replace the entire file contents with the latest repo version:
   - `gs/WaitNode.js` into `WaitNode.gs`
   - `gs/ClaimStatistics.js` into `ClaimStatistics.gs`
   - `gs/ReviewRepository.js` into `ReviewRepository.gs`
   - `gs/ReviewMappers.js` into `ReviewMappers.gs`
   - `html/SidebarUI.html` into `SidebarUI.html`
   - `html/ApprovalModal.html` into `ApprovalModal.html`
   - `html/ClaimStatsModal.html` into `ClaimStatsModal.html`
   - `html/ClaimStatsDiagnosticsModal.html` into `ClaimStatsDiagnosticsModal.html`
5. Save all files in the Apps Script project.
6. Refresh the spreadsheet.
7. Re-open the custom menu, sidebar, and modal flows to test the updated version.

Important:

- Replace the full contents of each Apps Script file.
- Do not leave older code mixed with newer code.
- If a runtime error mentions older variables such as `claim`, the Apps Script project still contains stale file content and needs a full overwrite.

## Workbook Tab Design

The current implementation assumes these tab roles:

- `Liability`
  The only mixed review tab. This tab can show both standard review items and grouped calendar review items.
- `Nat`
  Standard-only review tab.
- `Cherie`
  Standard-only review tab.
- `Angelene`
  Standard-only review tab.
- `Tina`
  Standard-only review tab.
- `NRMA/Justin`
  Standard-only review tab.
- `Calendar Events`
  Storage-only tab for flattened calendar events. This tab never displays review items in the sidebar.

If you rename any of these tabs, update the names in `ReviewRepository.gs`.

## What Appears In The Sidebar

- `Liability`: standard + calendar review items
- `Nat`: standard only
- `Cherie`: standard only
- `Angelene`: standard only
- `Tina`: standard only
- `NRMA/Justin`: standard only
- `Calendar Events`: no review items

## Required Standard Tab Configuration

Standard review tabs still use fixed column numbers.

The current implementation expects these meanings and positions:

- `rego` = column `2`
- `REVIEW STATUS` = column `53`
- `RESUME URL` = column `54`
- `PENDING AI NOTES` = column `55`
- `AI SUMMARY` = column `56`
- `EMAIL RECEIVED DATE` = column `57`

These values are defined in `gs/ReviewRepository.js` under `REVIEW_PORTAL_CONFIG.standardColumns`.

The current implementation expects these sheet meanings:

- `REVIEW STATUS`
  Status field used to decide whether the row is pending.
- `RESUME URL`
  Callback URL used to resume or notify n8n.
- `PENDING AI NOTES`
  Editable notes field for the standard modal.
- `AI SUMMARY`
  Read-only summary field for the standard modal.
- `EMAIL RECEIVED DATE`
  Date displayed in the standard review tile.

Update the fixed numeric positions in `ReviewRepository.gs` if your actual standard-sheet column numbers are different.

Edit these numeric positions in `REVIEW_PORTAL_CONFIG.standardColumns` inside `ReviewRepository.gs`.

The code is intentionally column-number based for standard tabs. It does not look up these fields by header name.

## Create The Calendar Events Tab

Create a sheet tab named `Calendar Events`.

This tab is required for calendar review items. It is a storage tab only and is not intended to be used as a review screen.

Add the header row exactly in this order:

`REGO | REVIEW STATUS | RESUME URL | CASE TITLE | CASE NUMBER | COURT OR VENUE | PARTY 1 NAME | CASE STATUS | REASON | EVENT TYPE | EVENT DATETIME SYDNEY | EVENT DATETIME TEXT | EVENT BASIS`

## Calendar Events Tab Design

Create a tab named `Calendar Events` with this fixed schema:

```text
A  REGO
B  REVIEW STATUS
C  RESUME URL
D  CASE TITLE
E  CASE NUMBER
F  COURT OR VENUE
G  PARTY 1 NAME
H  CASE STATUS
I  REASON
J  EVENT TYPE
K  EVENT DATETIME SYDNEY
L  EVENT DATETIME TEXT
M  EVENT BASIS
```

How it works:

- one parsed calendar event becomes one row
- repeated case-level metadata is copied onto every row for that case
- grouped calendar review items are built from all rows with the same `CASE NUMBER`
- only rows with `REVIEW STATUS = Awaiting Review` appear in the `Liability` sidebar
- `REVIEW STATUS` and `RESUME URL` are operational fields and still need to be populated on each calendar row

Recommended storage rules:

- `CASE NUMBER`
  Case-level grouping key for all rows that belong to the same calendar review
- `EVENT DATETIME SYDNEY`
  Use a sortable Sydney datetime string such as `2026-10-21T09:00:00+11:00`
- duplicate events should be avoided before writing to the tab

Rows in `Calendar Events` are grouped by `CASE NUMBER`.

This means:

- multiple event rows with the same `CASE NUMBER` become one calendar tile in `Liability`
- the modal opens one case review and lists all grouped events
- approve or deny updates all rows with that same `CASE NUMBER`

## Duplicate Calendar Events

If duplicate event rows exist for the same `CASE NUMBER`, the portal de-duplicates them in the modal using:

- `EVENT TYPE`
- `EVENT DATETIME SYDNEY`
- `EVENT DATETIME TEXT`

The sheet may still contain duplicate rows even if the modal shows only one event card.

## How The Sidebar Works

- On `Liability`, the sidebar loads:
  - standard pending rows from `Liability`
  - calendar pending rows from `Calendar Events`, grouped by `CASE NUMBER`
- On `Nat`, `Cherie`, `Angelene`, `Tina`, and `NRMA/Justin`, the sidebar loads only standard pending rows from the active tab
- On `Calendar Events`, the sidebar intentionally shows no review items

Calendar reviews are loaded directly from `Calendar Events`. They do not need a matching row in `Liability`.

## Calendar Modal Editing

Calendar reviews are editable inside the modal before approval.

Current behavior:

- reviewer notes are not used for calendar reviews
- the calendar modal includes a `+ Add Event` control
- existing events can be edited directly in the modal
- events can be removed directly in the modal
- approval is blocked if no events remain

Editable calendar fields:

- `EVENT TYPE`
- `EVENT DATETIME SYDNEY`
- `EVENT DATETIME TEXT`
- `EVENT BASIS`

When a calendar review is approved:

- the matching `Calendar Events` rows are rewritten from the edited event list
- the rewritten rows are marked `Approved`
- the callback payload uses the edited event list

When a calendar review is denied:

- the matching `Calendar Events` rows are marked `Denied`
- the sheet rows are not rewritten from edited event changes

## Sydney Time Rule

Calendar datetime editing uses a local date/time input in the modal, but the entered value is always treated as Australia/Sydney time.

This means:

- the user edits a Sydney-local date/time value
- the script converts it back into the stored sheet format
- the stored format remains an ISO-style Sydney datetime such as `2026-11-18T11:30:00+11:00`

Do not enter other timezone interpretations into the modal. The system assumes Sydney time for calendar review edits.

## Example Calendar Storage Result

If one calendar-relevant email produces three parsed events:

- three rows are written to `Calendar Events`
- all three rows share the same `CASE NUMBER`
- `Liability` shows one calendar tile for that case
- `Nat` shows no calendar tile for that case
- `Calendar Events` shows no review tiles at all

## Running The Script

1. Save the Apps Script project.
2. Refresh the Google Sheet in your browser.
3. Confirm the `Legal Portal` custom menu appears.
4. Confirm the `Analytics` custom menu appears.
5. Open `Legal Portal > Open Review Monitor`.
6. Open the `Liability` tab and confirm the sidebar can show both standard and calendar items.
7. Open `Nat`, `Cherie`, `Angelene`, `Tina`, and `NRMA/Justin` and confirm the sidebar shows only standard items.
8. Open `Calendar Events` and confirm the sidebar shows no review items.
9. Open a standard review tile and confirm the modal shows summary and editable notes.
10. Open a calendar review tile in `Liability` and confirm the modal shows case details, reason, and grouped events.
11. Test approve and deny actions on suitable rows.

## Analytics Menu

The project also creates a separate `Analytics` menu with:

- `Open Claim Statistics`
- `Diagnostics`

`Analytics > Open Claim Statistics` opens a read-only modal patterned after the review modal. Use the modal controls to choose `Day`, `Week`, `Month`, or `All`, select the report date, and refresh the report without reopening the menu.

These reports scan the `Liability` tab and use exact section labels in column A:

- `NEW CLAIMS`
- `LIABILITY CONFIRMED`

The first report run creates and hides `_Claim Stats Log`. Existing rows are written as baseline records and are not counted as new activity. Future rows are logged by detection time in the `Australia/Sydney` timezone.

Claim identity is based on normalized `CLAIM NUMBER` plus `REGO`. Rows missing either value are ignored by the statistics scanner.

## Authorization Notes

The first time you run the script, Google will ask you to authorize it.

Because this project reads the spreadsheet and sends external HTTP requests, you should expect permission prompts related to:

- Google Sheets access
- Apps Script UI access
- External requests through `UrlFetchApp.fetch`

If the custom menu appears but an action does not run yet, trigger the script again and complete the authorization flow when prompted.

## Manual Validation Checklist

- `Liability` shows standard tiles
- `Liability` shows grouped calendar tiles
- `Nat` shows only standard tiles
- `Cherie` shows only standard tiles
- `Angelene` shows only standard tiles
- `Tina` shows only standard tiles
- `NRMA/Justin` shows only standard tiles
- `Calendar Events` shows no review items
- standard modal renders
- calendar modal renders grouped event cards
- calendar modal allows editing event type
- calendar modal allows editing Sydney datetime
- calendar modal allows editing detail and basis
- calendar modal allows adding a new event
- calendar modal allows removing an event
- calendar approval is blocked if no events remain
- approve works for standard reviews
- approve works for calendar case reviews
- deny works for standard reviews
- deny works for calendar case reviews
- n8n callback is reached
- sheet cells and review status update as expected

## Known Assumptions

This implementation assumes:

- `Liability` is the only mixed review tab
- `Nat`, `Cherie`, `Angelene`, `Tina`, and `NRMA/Justin` are standard-only tabs
- `Calendar Events` is the exact storage tab name
- `_Claim Stats Log` is reserved for the hidden claim statistics event log
- `NEW CLAIMS` and `LIABILITY CONFIRMED` are exact section labels in column A of `Liability`
- calendar case approval is one decision per `CASE NUMBER`
- standard rows and calendar rows already contain valid `RESUME URL` values
- standard review tabs continue to use fixed column-number references in code

## Future Direction

This manual copy-and-paste flow is temporary.

Later, this folder can be deployed programmatically with a tool such as `clasp` or another release workflow, but that automation is intentionally out of scope for the current setup.
