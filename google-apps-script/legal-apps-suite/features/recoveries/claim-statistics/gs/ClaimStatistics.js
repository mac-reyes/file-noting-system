const CLAIM_STATS_CONFIG = {
  logSheetName: '_Claim Stats Log',
  sourceSheetName: 'Liability',
  droppedCasesSheetName: 'Dropped Cases',
  droppedCasesSection: 'DROPPED CASES',
  timezone: 'Australia/Sydney',
  // A section banner is matched when a cell within the first few columns of a
  // row starts with one of these prefixes (compared case-insensitively, after
  // collapsing whitespace and non-breaking spaces). New claims may be split
  // across multiple banners (e.g. "NEW CLAIMS VIA MANUAL INPUT" and
  // "NEW CLAIMS VIA DIGITAL CLAIM FORM"); records under any of them are counted
  // as new claims.
  bannerPrefixes: {
    newClaims: ['NEW CLAIM'],
    liabilityConfirmed: ['LIABILITY CONFIRMED']
  },
  bannerScanColumns: 3,
  headers: {
    rego: 'REGO',
    clientName: 'CLIENT NAME',
    insurer: 'INSURER'
  },
  logHeaders: [
    'EVENT ID',
    'EVENT TYPE',
    'LOGGED AT SYDNEY',
    'DATE KEY SYDNEY',
    'WEEK KEY SYDNEY',
    'MONTH KEY SYDNEY',
    'CLAIM KEY',
    'REGO',
    'CLIENT NAME',
    'INSURER',
    'SOURCE SHEET',
    'SOURCE SECTION',
    'SOURCE ROW'
  ],
  eventTypes: {
    baselineNewClaim: 'BASELINE_NEW_CLAIM',
    baselineLiabilityConfirmed: 'BASELINE_LIABILITY_CONFIRMED',
    baselineDroppedCase: 'BASELINE_DROPPED_CASE',
    newClaim: 'NEW_CLAIM',
    liabilityConfirmed: 'LIABILITY_CONFIRMED',
    droppedCase: 'DROPPED_CASE'
  }
};

function showClaimStatsDiagnostics() {
  try {
    ensureClaimStatsAutoRefresh_();
    const result = refreshClaimStatsLog_();
    const diagnostics = buildClaimStatsDiagnosticsReport_(result.loggedAt);
    const template = HtmlService.createTemplateFromFile('ClaimStatsDiagnosticsModal');
    template.diagnostics = diagnostics;

    const html = template.evaluate().setWidth(660).setHeight(720);
    SpreadsheetApp.getUi().showModalDialog(html, 'Claim Statistics Diagnostics');
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Claim Statistics Error',
      error && error.message ? error.message : String(error),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function showClaimStatsModal() {
  try {
    ensureClaimStatsAutoRefresh_();
    const report = getClaimStatsReport('custom', '', '');
    const template = HtmlService.createTemplateFromFile('ClaimStatsModal');
    template.report = report;

    const html = template.evaluate().setWidth(700).setHeight(680);
    SpreadsheetApp.getUi().showModalDialog(html, 'Claim Statistics');
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Claim Statistics Error',
      error && error.message ? error.message : String(error),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function getClaimStatsReport(preset, fromDateKey, toDateKey) {
  const result = refreshClaimStatsLog_();
  return buildClaimStatsReport_(preset || 'custom', result.loggedAt, fromDateKey || '', toDateKey || '');
}

const CLAIM_STATS_REFRESH_HANDLER = 'runClaimStatsAutoRefresh';
const CLAIM_STATS_REFRESH_INTERVAL_MINUTES = 30;
const CLAIM_STATS_REFRESH_STARTED_AT_KEY = 'CLAIM_STATS_AUTO_REFRESH_STARTED_AT';

/**
 * Installs the time-based auto-refresh trigger (every 30 minutes) if one is not
 * already present, and records when it started. Called automatically when the
 * modal/diagnostics open, so the trigger self-installs on first use with no
 * manual step. Best-effort: any failure (e.g. scope not yet authorized) is
 * logged and ignored so it never blocks opening the modal.
 */
function ensureClaimStatsAutoRefresh_() {
  try {
    if (hasClaimStatsAutoRefreshTrigger_()) {
      return;
    }

    ScriptApp.newTrigger(CLAIM_STATS_REFRESH_HANDLER)
      .timeBased()
      .everyMinutes(CLAIM_STATS_REFRESH_INTERVAL_MINUTES)
      .create();

    // The trigger was just (re)created, so stamp the start time. This only runs
    // when no trigger existed, so an already-running timer is never reset.
    PropertiesService.getScriptProperties()
      .setProperty(CLAIM_STATS_REFRESH_STARTED_AT_KEY, String(Date.now()));
  } catch (error) {
    Logger.log('Could not ensure claim stats auto-refresh trigger: %s', error && error.message ? error.message : error);
  }
}

function hasClaimStatsAutoRefreshTrigger_() {
  return ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === CLAIM_STATS_REFRESH_HANDLER;
  });
}

/**
 * Returns the auto-refresh trigger status for display in the modal: whether it
 * is active, when it started, and a human-readable "running for" duration.
 * Best-effort: if triggers cannot be read, returns an inactive status rather
 * than throwing so the report still renders.
 */
function getClaimStatsAutoRefreshStatus_() {
  const status = {
    active: false,
    intervalMinutes: CLAIM_STATS_REFRESH_INTERVAL_MINUTES,
    startedAtDisplay: '',
    runningForText: ''
  };

  let active = false;
  try {
    active = hasClaimStatsAutoRefreshTrigger_();
  } catch (error) {
    Logger.log('Could not read project triggers for status: %s', error && error.message ? error.message : error);
    return status;
  }

  status.active = active;
  if (!active) {
    return status;
  }

  const startedAtRaw = PropertiesService.getScriptProperties().getProperty(CLAIM_STATS_REFRESH_STARTED_AT_KEY);
  const startedAtMs = Number(startedAtRaw);
  if (startedAtRaw && !isNaN(startedAtMs)) {
    status.startedAtDisplay = Utilities.formatDate(new Date(startedAtMs), CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd HH:mm');
    status.runningForText = formatClaimStatsDuration_(Date.now() - startedAtMs);
  }

  return status;
}

function formatClaimStatsDuration_(milliseconds) {
  if (!milliseconds || milliseconds < 0) {
    return 'less than a minute';
  }

  const totalMinutes = Math.floor(milliseconds / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) {
    parts.push(days + (days === 1 ? ' day' : ' days'));
  }
  if (hours) {
    parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
  }
  if (minutes || !parts.length) {
    parts.push(minutes + (minutes === 1 ? ' minute' : ' minutes'));
  }

  return parts.join(' ');
}

/**
 * Time-based trigger handler. Runs the same scan as opening the modal, appending
 * any newly observed claim events to the log. Errors are logged rather than
 * thrown so a transient failure does not generate owner failure notifications.
 */
function runClaimStatsAutoRefresh() {
  try {
    refreshClaimStatsLog_();
  } catch (error) {
    Logger.log('Claim stats auto-refresh failed: %s', error && error.stack ? error.stack : error);
  }
}

function refreshClaimStatsLog_() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ensureClaimStatsLogSheet_(spreadsheet);
    const snapshot = scanClaimStatsSections_(spreadsheet);
    const logState = readClaimStatsLogState_(logSheet);
    const now = new Date();
    const dateKeys = buildClaimStatsDateKeys_(now);

    if (!logState.hasBaseline) {
      appendClaimStatsBaselineRows_(logSheet, snapshot, dateKeys);
      appendClaimStatsDroppedBaselineRows_(logSheet, snapshot, dateKeys);
      return {
        initialized: true,
        loggedAt: now
      };
    }

    appendClaimStatsEventRows_(logSheet, snapshot, logState, dateKeys);

    if (!logState.hasDroppedBaseline) {
      // The Dropped Cases tab was added after the log was already initialized
      // for Liability. Backfill a one-time baseline so pre-existing dropped rows
      // are recorded but not counted, matching the Liability baseline behavior.
      appendClaimStatsDroppedBaselineRows_(logSheet, snapshot, dateKeys);
    } else {
      appendClaimStatsDroppedEventRows_(logSheet, snapshot, logState, dateKeys);
    }

    return {
      initialized: false,
      loggedAt: now
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureClaimStatsLogSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CLAIM_STATS_CONFIG.logSheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CLAIM_STATS_CONFIG.logSheetName);
    sheet.getRange(1, 1, 1, CLAIM_STATS_CONFIG.logHeaders.length)
      .setValues([CLAIM_STATS_CONFIG.logHeaders]);
  } else {
    ensureClaimStatsLogHeaders_(sheet);
  }

  sheet.hideSheet();
  return sheet;
}

function ensureClaimStatsLogHeaders_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, CLAIM_STATS_CONFIG.logHeaders.length);
  const existingHeaders = headerRange.getValues()[0];
  const hasHeaders = existingHeaders.some(function(value) {
    return claimStatsString_(value).trim();
  });

  if (!hasHeaders) {
    headerRange.setValues([CLAIM_STATS_CONFIG.logHeaders]);
    return;
  }

  const missingHeaders = CLAIM_STATS_CONFIG.logHeaders.filter(function(header, index) {
    return existingHeaders[index] !== header;
  });

  if (missingHeaders.length) {
    throw new Error(
      'The "' + CLAIM_STATS_CONFIG.logSheetName + '" sheet exists but its headers do not match the expected claim statistics log schema.'
    );
  }
}

function scanClaimStatsSections_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CLAIM_STATS_CONFIG.sourceSheetName);
  if (!sheet) {
    throw new Error('Sheet "' + CLAIM_STATS_CONFIG.sourceSheetName + '" was not found.');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('The "' + CLAIM_STATS_CONFIG.sourceSheetName + '" sheet does not contain enough rows to scan.');
  }

  const headerIndexes = getClaimStatsHeaderIndexes_(values[0]);
  const sections = findClaimStatsSections_(values);

  return {
    newClaims: extractClaimStatsRowsFromSections_(values, sheet.getName(), sections.newClaims, headerIndexes),
    liabilityConfirmed: extractClaimStatsRows_(values, sheet.getName(), sections.liabilityConfirmed, headerIndexes),
    droppedCases: scanClaimStatsDroppedRows_(spreadsheet, headerIndexes)
  };
}

function extractClaimStatsRowsFromSections_(values, sheetName, sections, headerIndexes) {
  const rowsByClaimKey = {};

  (sections || []).forEach(function(section) {
    extractClaimStatsRows_(values, sheetName, section, headerIndexes).forEach(function(claim) {
      if (!rowsByClaimKey[claim.claimKey]) {
        rowsByClaimKey[claim.claimKey] = claim;
      }
    });
  });

  return Object.keys(rowsByClaimKey).sort().map(function(claimKey) {
    return rowsByClaimKey[claimKey];
  });
}

function scanClaimStatsDroppedRows_(spreadsheet, headerIndexes) {
  const sheet = spreadsheet.getSheetByName(CLAIM_STATS_CONFIG.droppedCasesSheetName);
  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    return [];
  }

  // The Dropped Cases tab has no header row, so every row (starting at row 1)
  // is treated as data. Column positions match the Liability data columns, so
  // the header indexes derived from the Liability header row are reused here.
  const section = {
    label: CLAIM_STATS_CONFIG.droppedCasesSection,
    startRow: 1,
    endRow: values.length
  };

  return extractClaimStatsRows_(values, sheet.getName(), section, headerIndexes);
}

function getClaimStatsHeaderIndexes_(headerRow) {
  const normalizedHeaders = headerRow.map(function(value) {
    return normalizeClaimStatsHeader_(value);
  });

  return {
    rego: getClaimStatsHeaderIndex_(normalizedHeaders, CLAIM_STATS_CONFIG.headers.rego),
    clientName: getClaimStatsHeaderIndex_(normalizedHeaders, CLAIM_STATS_CONFIG.headers.clientName),
    insurer: getClaimStatsHeaderIndex_(normalizedHeaders, CLAIM_STATS_CONFIG.headers.insurer)
  };
}

function getClaimStatsHeaderIndex_(normalizedHeaders, headerName) {
  const index = normalizedHeaders.indexOf(normalizeClaimStatsHeader_(headerName));
  if (index === -1) {
    throw new Error('Required claim statistics header "' + headerName + '" was not found in row 1.');
  }

  return index;
}

function findClaimStatsSections_(values) {
  const banners = [];

  values.forEach(function(rowValues, rowIndex) {
    const newClaimsLabel = matchClaimStatsBannerLabel_(rowValues, CLAIM_STATS_CONFIG.bannerPrefixes.newClaims);
    if (newClaimsLabel) {
      banners.push({ type: 'newClaims', row: rowIndex + 1, label: newClaimsLabel });
      return;
    }

    const liabilityLabel = matchClaimStatsBannerLabel_(rowValues, CLAIM_STATS_CONFIG.bannerPrefixes.liabilityConfirmed);
    if (liabilityLabel) {
      banners.push({ type: 'liabilityConfirmed', row: rowIndex + 1, label: liabilityLabel });
    }
  });

  const newClaimBanners = banners.filter(function(banner) {
    return banner.type === 'newClaims';
  });
  const liabilityBanners = banners.filter(function(banner) {
    return banner.type === 'liabilityConfirmed';
  });

  if (!newClaimBanners.length) {
    throw new Error(
      'No "NEW CLAIMS" section banner was found in the "' + CLAIM_STATS_CONFIG.sourceSheetName +
      '" sheet (expected a row such as "NEW CLAIMS VIA MANUAL INPUT").'
    );
  }

  if (liabilityBanners.length !== 1) {
    throw new Error(
      'Expected exactly one "LIABILITY CONFIRMED" banner in the "' + CLAIM_STATS_CONFIG.sourceSheetName +
      '" sheet, but found ' + liabilityBanners.length + '.'
    );
  }

  const liabilityBanner = liabilityBanners[0];
  const misordered = newClaimBanners.some(function(banner) {
    return banner.row >= liabilityBanner.row;
  });

  if (misordered) {
    throw new Error(
      'All "NEW CLAIMS" banners must appear before "LIABILITY CONFIRMED" in the "' +
      CLAIM_STATS_CONFIG.sourceSheetName + '" sheet.'
    );
  }

  const orderedBanners = banners.slice().sort(function(left, right) {
    return left.row - right.row;
  });

  function buildSection(banner) {
    const nextBanner = orderedBanners.find(function(candidate) {
      return candidate.row > banner.row;
    });

    return {
      label: banner.label,
      startRow: banner.row + 1,
      endRow: nextBanner ? nextBanner.row - 1 : values.length
    };
  }

  return {
    newClaims: newClaimBanners.map(buildSection),
    liabilityConfirmed: buildSection(liabilityBanner)
  };
}

/**
 * Returns the displayed text of the first banner cell (within the first few
 * columns) whose normalized value starts with one of the given prefixes, or ''
 * if the row is not a banner. Scanning a few columns rather than only column A
 * tolerates banners whose merged cell is anchored slightly differently.
 */
function matchClaimStatsBannerLabel_(rowValues, prefixes) {
  const cells = rowValues || [];
  const scanLimit = Math.min(cells.length, CLAIM_STATS_CONFIG.bannerScanColumns);

  for (let index = 0; index < scanLimit; index++) {
    const normalized = normalizeClaimStatsLabel_(cells[index]);
    if (!normalized) {
      continue;
    }

    for (let prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex++) {
      if (normalized.indexOf(normalizeClaimStatsLabel_(prefixes[prefixIndex])) === 0) {
        return claimStatsString_(cells[index]).trim();
      }
    }
  }

  return '';
}

function normalizeClaimStatsLabel_(value) {
  return claimStatsString_(value)
    .replace(/\u00a0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function extractClaimStatsRows_(values, sheetName, section, headerIndexes) {
  const rowsByClaimKey = {};

  for (let rowNumber = section.startRow; rowNumber <= section.endRow; rowNumber++) {
    const rowValues = values[rowNumber - 1];
    if (!rowValues || isClaimStatsBlankRow_(rowValues)) {
      continue;
    }

    const rego = claimStatsString_(rowValues[headerIndexes.rego]).trim();
    const claimKey = buildClaimStatsKey_(rego);

    if (!claimKey) {
      continue;
    }

    if (!rowsByClaimKey[claimKey]) {
      rowsByClaimKey[claimKey] = {
        claimKey: claimKey,
        rego: rego,
        clientName: claimStatsString_(rowValues[headerIndexes.clientName]).trim(),
        insurer: claimStatsString_(rowValues[headerIndexes.insurer]).trim(),
        sourceSheet: sheetName,
        sourceSection: section.label,
        sourceRow: rowNumber
      };
    }
  }

  return Object.keys(rowsByClaimKey).sort().map(function(claimKey) {
    return rowsByClaimKey[claimKey];
  });
}

function isClaimStatsBlankRow_(rowValues) {
  return rowValues.every(function(value) {
    return !claimStatsString_(value).trim();
  });
}

function buildClaimStatsKey_(rego) {
  const normalizedRego = normalizeClaimStatsKeyPart_(rego);

  if (!normalizedRego) {
    return '';
  }

  return normalizedRego;
}

function normalizeClaimStatsKeyPart_(value) {
  return claimStatsString_(value).trim().toUpperCase();
}

function normalizeClaimStatsHeader_(value) {
  return claimStatsString_(value).trim().toUpperCase();
}

function readClaimStatsLogState_(logSheet) {
  const values = getClaimStatsLogValues_(logSheet);
  const eventTypeIndex = getClaimStatsLogColumnIndex_('EVENT TYPE');
  const claimKeyIndex = getClaimStatsLogColumnIndex_('CLAIM KEY');
  const state = {
    hasBaseline: false,
    hasDroppedBaseline: false,
    newClaimKeys: {},
    liabilityConfirmedKeys: {},
    droppedCaseKeys: {},
    events: []
  };

  values.forEach(function(rowValues) {
    const eventType = claimStatsString_(rowValues[eventTypeIndex]);
    const claimKey = claimStatsString_(rowValues[claimKeyIndex]);
    if (!eventType || !claimKey) {
      return;
    }

    if (
      eventType === CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim ||
      eventType === CLAIM_STATS_CONFIG.eventTypes.baselineLiabilityConfirmed
    ) {
      state.hasBaseline = true;
    }

    if (
      eventType === CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim ||
      eventType === CLAIM_STATS_CONFIG.eventTypes.newClaim
    ) {
      state.newClaimKeys[claimKey] = true;
    }

    if (
      eventType === CLAIM_STATS_CONFIG.eventTypes.baselineLiabilityConfirmed ||
      eventType === CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed
    ) {
      state.liabilityConfirmedKeys[claimKey] = true;
    }

    if (eventType === CLAIM_STATS_CONFIG.eventTypes.baselineDroppedCase) {
      state.hasBaseline = true;
      state.hasDroppedBaseline = true;
    }

    if (
      eventType === CLAIM_STATS_CONFIG.eventTypes.baselineDroppedCase ||
      eventType === CLAIM_STATS_CONFIG.eventTypes.droppedCase
    ) {
      state.droppedCaseKeys[claimKey] = true;
    }

    state.events.push(rowValues);
  });

  return state;
}

function getClaimStatsLogValues_(logSheet) {
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  return logSheet.getRange(2, 1, lastRow - 1, CLAIM_STATS_CONFIG.logHeaders.length).getValues();
}

function appendClaimStatsBaselineRows_(logSheet, snapshot, dateKeys) {
  const rows = snapshot.newClaims.map(function(claim) {
    return buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim, claim, dateKeys);
  }).concat(snapshot.liabilityConfirmed.map(function(claim) {
    return buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.baselineLiabilityConfirmed, claim, dateKeys);
  }));

  if (!rows.length) {
    rows.push(buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim, {
      claimKey: '__BASELINE__',
      rego: '',
      clientName: 'Baseline initialized with no claim rows',
      insurer: '',
      sourceSheet: CLAIM_STATS_CONFIG.sourceSheetName,
      sourceSection: 'BASELINE',
      sourceRow: ''
    }, dateKeys));
  }

  appendClaimStatsLogRows_(logSheet, rows);
}

function appendClaimStatsEventRows_(logSheet, snapshot, logState, dateKeys) {
  const rows = [];

  snapshot.newClaims.forEach(function(claim) {
    if (!logState.newClaimKeys[claim.claimKey]) {
      rows.push(buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.newClaim, claim, dateKeys));
      logState.newClaimKeys[claim.claimKey] = true;
    }
  });

  snapshot.liabilityConfirmed.forEach(function(claim) {
    if (!logState.liabilityConfirmedKeys[claim.claimKey]) {
      rows.push(buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed, claim, dateKeys));
      logState.liabilityConfirmedKeys[claim.claimKey] = true;
    }
  });

  appendClaimStatsLogRows_(logSheet, rows);
}

function appendClaimStatsDroppedBaselineRows_(logSheet, snapshot, dateKeys) {
  const droppedCases = (snapshot && snapshot.droppedCases) || [];
  const rows = droppedCases.map(function(claim) {
    return buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.baselineDroppedCase, claim, dateKeys);
  });

  if (!rows.length) {
    rows.push(buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.baselineDroppedCase, {
      claimKey: '__BASELINE__',
      rego: '',
      clientName: 'Baseline initialized with no dropped case rows',
      insurer: '',
      sourceSheet: CLAIM_STATS_CONFIG.droppedCasesSheetName,
      sourceSection: CLAIM_STATS_CONFIG.droppedCasesSection,
      sourceRow: ''
    }, dateKeys));
  }

  appendClaimStatsLogRows_(logSheet, rows);
}

function appendClaimStatsDroppedEventRows_(logSheet, snapshot, logState, dateKeys) {
  const rows = [];

  ((snapshot && snapshot.droppedCases) || []).forEach(function(claim) {
    if (!logState.droppedCaseKeys[claim.claimKey]) {
      rows.push(buildClaimStatsLogRow_(CLAIM_STATS_CONFIG.eventTypes.droppedCase, claim, dateKeys));
      logState.droppedCaseKeys[claim.claimKey] = true;
    }
  });

  appendClaimStatsLogRows_(logSheet, rows);
}

function appendClaimStatsLogRows_(logSheet, rows) {
  if (!rows.length) {
    return;
  }

  const range = logSheet.getRange(logSheet.getLastRow() + 1, 1, rows.length, CLAIM_STATS_CONFIG.logHeaders.length);
  range.setNumberFormat('@');
  range.setValues(rows);
}

function buildClaimStatsLogRow_(eventType, claim, dateKeys) {
  const eventId = [
    eventType,
    claim.claimKey,
    dateKeys.loggedAtCompact,
    claim.sourceRow
  ].join('|');

  return [
    eventId,
    eventType,
    dateKeys.loggedAtDisplay,
    dateKeys.dateKey,
    dateKeys.weekKey,
    dateKeys.monthKey,
    claim.claimKey,
    claim.rego,
    claim.clientName,
    claim.insurer,
    claim.sourceSheet,
    claim.sourceSection,
    claim.sourceRow
  ];
}

function buildClaimStatsReport_(preset, now, fromDateKey, toDateKey) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ensureClaimStatsLogSheet_(spreadsheet);
  const dateKeys = buildClaimStatsDateKeys_(now || new Date());
  const rangeDefaults = buildClaimStatsRangeDefaults_(now || new Date());
  const rangeConfig = getClaimStatsRangeConfig_(preset, fromDateKey, toDateKey, rangeDefaults);
  const rows = getClaimStatsLogValues_(logSheet);
  const reportRows = rows.filter(function(rowValues) {
    return isClaimStatsRowInRange_(rowValues, rangeConfig);
  });
  const grouped = groupClaimStatsReportRows_(reportRows);
  const samePeriodClaims = getClaimStatsIntersection_(grouped.newClaims, grouped.liabilityConfirmed);
  const newClaims = claimStatsObjectValues_(grouped.newClaims);
  const liabilityConfirmed = claimStatsObjectValues_(grouped.liabilityConfirmed);
  const droppedCases = claimStatsObjectValues_(grouped.droppedCases);

  return {
    title: 'Claim Statistics - ' + rangeConfig.label,
    badge: 'Claim Statistics',
    subtitle: rangeConfig.rangeLabel + ' - ' + CLAIM_STATS_CONFIG.timezone,
    preset: rangeConfig.preset,
    fromDateKey: rangeConfig.fromDateKey,
    toDateKey: rangeConfig.toDateKey,
    rangeDefaults: rangeDefaults,
    rangeLabel: rangeConfig.rangeLabel,
    filterLabel: rangeConfig.isAll
      ? 'All non-baseline events'
      : 'DATE KEY SYDNEY between ' + rangeConfig.fromDateKey + ' and ' + rangeConfig.toDateKey,
    lastScanned: dateKeys.loggedAtDisplay,
    autoRefresh: getClaimStatsAutoRefreshStatus_(),
    totals: {
      newClaims: newClaims.length,
      liabilityConfirmed: liabilityConfirmed.length,
      droppedCases: droppedCases.length,
      samePeriodConfirmed: samePeriodClaims.length
    },
    sections: {
      newClaims: newClaims,
      liabilityConfirmed: liabilityConfirmed,
      droppedCases: droppedCases,
      samePeriodConfirmed: samePeriodClaims
    }
  };
}

function buildClaimStatsDiagnosticsReport_(now) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ensureClaimStatsLogSheet_(spreadsheet);
  const snapshot = scanClaimStatsSections_(spreadsheet);
  const rows = getClaimStatsLogValues_(logSheet);
  const counts = {};
  const dateKeys = buildClaimStatsDateKeys_(now || new Date());
  const eventTypeIndex = getClaimStatsLogColumnIndex_('EVENT TYPE');
  const claimKeyIndex = getClaimStatsLogColumnIndex_('CLAIM KEY');
  const loggedAtIndex = getClaimStatsLogColumnIndex_('LOGGED AT SYDNEY');
  const lastRows = rows.slice(Math.max(0, rows.length - 8)).map(function(rowValues) {
    const eventType = claimStatsString_(rowValues[eventTypeIndex]) || '(blank)';
    const claimKey = claimStatsString_(rowValues[claimKeyIndex]) || '(blank)';
    const loggedAt = formatClaimStatsLogDisplayValue_(rowValues[loggedAtIndex]) || '(blank)';
    return {
      eventType: eventType,
      claimKey: claimKey,
      loggedAt: loggedAt
    };
  });

  rows.forEach(function(rowValues) {
    const eventType = claimStatsString_(rowValues[eventTypeIndex]) || '(blank)';
    counts[eventType] = (counts[eventType] || 0) + 1;
  });

  const newClaimCount = counts[CLAIM_STATS_CONFIG.eventTypes.newClaim] || 0;
  const liabilityConfirmedCount = counts[CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed] || 0;
  const droppedCaseCount = counts[CLAIM_STATS_CONFIG.eventTypes.droppedCase] || 0;

  return {
    title: 'Claim Statistics Diagnostics',
    lastScanned: dateKeys.loggedAtDisplay,
    currentScan: {
      newClaimsRows: snapshot.newClaims.length,
      liabilityConfirmedRows: snapshot.liabilityConfirmed.length,
      droppedCasesRows: snapshot.droppedCases.length
    },
    logSummary: {
      totalRows: rows.length,
      reportableEvents: newClaimCount + liabilityConfirmedCount + droppedCaseCount
    },
    eventCounts: {
      baselineNewClaim: counts[CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim] || 0,
      baselineLiabilityConfirmed: counts[CLAIM_STATS_CONFIG.eventTypes.baselineLiabilityConfirmed] || 0,
      baselineDroppedCase: counts[CLAIM_STATS_CONFIG.eventTypes.baselineDroppedCase] || 0,
      newClaim: newClaimCount,
      liabilityConfirmed: liabilityConfirmedCount,
      droppedCase: droppedCaseCount
    },
    recentRows: lastRows
  };
}

function getClaimStatsRangeConfig_(preset, fromDateKey, toDateKey, rangeDefaults) {
  const normalizedPreset = normalizeClaimStatsPreset_(preset);

  if (normalizedPreset === 'all') {
    return {
      preset: 'all',
      label: 'All Logged Activity',
      fromDateKey: '',
      toDateKey: '',
      isAll: true,
      rangeLabel: 'All non-baseline log events'
    };
  }

  const defaultRange = rangeDefaults[normalizedPreset] || rangeDefaults.today;
  const normalizedFrom = claimStatsString_(fromDateKey).trim() || defaultRange.fromDateKey;
  const normalizedTo = claimStatsString_(toDateKey).trim() || defaultRange.toDateKey;
  validateClaimStatsDateRange_(normalizedFrom, normalizedTo);

  return {
    preset: normalizedPreset,
    label: getClaimStatsPresetLabel_(normalizedPreset),
    fromDateKey: normalizedFrom,
    toDateKey: normalizedTo,
    isAll: false,
    rangeLabel: normalizedFrom === normalizedTo
      ? normalizedFrom
      : normalizedFrom + ' to ' + normalizedTo
  };
}

function normalizeClaimStatsPreset_(preset) {
  const normalizedPreset = claimStatsString_(preset).trim().toLowerCase();
  const aliases = {
    day: 'today',
    week: 'this_week',
    month: 'this_month',
    today: 'today',
    this_week: 'this_week',
    this_month: 'this_month',
    this_year: 'this_year',
    year: 'this_year',
    custom: 'custom',
    all: 'all'
  };

  if (!normalizedPreset) {
    return 'custom';
  }

  if (!aliases[normalizedPreset]) {
    throw new Error('Unsupported claim statistics preset "' + preset + '".');
  }

  return aliases[normalizedPreset];
}

function getClaimStatsPresetLabel_(preset) {
  const labels = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
    custom: 'Custom Range',
    all: 'All Logged Activity'
  };

  return labels[preset] || labels.today;
}

function validateClaimStatsDateRange_(fromDateKey, toDateKey) {
  validateClaimStatsDateKey_(fromDateKey, 'From date');
  validateClaimStatsDateKey_(toDateKey, 'To date');

  if (fromDateKey > toDateKey) {
    throw new Error('From date must be before or equal to To date.');
  }
}

function validateClaimStatsDateKey_(dateKey, label) {
  if (!dateKey) {
    throw new Error(label + ' is required.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(label + ' must use yyyy-MM-dd format.');
  }

  const parts = dateKey.split('-').map(function(part) {
    return Number(part);
  });
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    throw new Error(label + ' is not a valid calendar date.');
  }
}

function isClaimStatsRowInRange_(rowValues, rangeConfig) {
  const eventType = claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('EVENT TYPE')]);
  const isReportableEvent = (
    eventType === CLAIM_STATS_CONFIG.eventTypes.newClaim ||
    eventType === CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed ||
    eventType === CLAIM_STATS_CONFIG.eventTypes.droppedCase
  );

  if (!isReportableEvent) {
    return false;
  }

  if (rangeConfig.isAll) {
    return true;
  }

  const keyValue = normalizeClaimStatsLogKeyValue_(
    rowValues[getClaimStatsLogColumnIndex_('DATE KEY SYDNEY')],
    'DATE KEY SYDNEY'
  );

  return keyValue >= rangeConfig.fromDateKey && keyValue <= rangeConfig.toDateKey;
}

function groupClaimStatsReportRows_(rows) {
  const grouped = {
    newClaims: {},
    liabilityConfirmed: {},
    droppedCases: {}
  };
  const eventTypeIndex = getClaimStatsLogColumnIndex_('EVENT TYPE');
  const claimKeyIndex = getClaimStatsLogColumnIndex_('CLAIM KEY');

  rows.forEach(function(rowValues) {
    const eventType = claimStatsString_(rowValues[eventTypeIndex]);
    const claimKey = claimStatsString_(rowValues[claimKeyIndex]);
    if (!claimKey) {
      return;
    }

    if (eventType === CLAIM_STATS_CONFIG.eventTypes.newClaim && !grouped.newClaims[claimKey]) {
      grouped.newClaims[claimKey] = buildClaimStatsReportClaim_(rowValues);
    }

    if (eventType === CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed && !grouped.liabilityConfirmed[claimKey]) {
      grouped.liabilityConfirmed[claimKey] = buildClaimStatsReportClaim_(rowValues);
    }

    if (eventType === CLAIM_STATS_CONFIG.eventTypes.droppedCase && !grouped.droppedCases[claimKey]) {
      grouped.droppedCases[claimKey] = buildClaimStatsReportClaim_(rowValues);
    }
  });

  return grouped;
}

function buildClaimStatsReportClaim_(rowValues) {
  return {
    claimKey: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('CLAIM KEY')]),
    rego: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('REGO')]),
    clientName: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('CLIENT NAME')]),
    insurer: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('INSURER')]),
    loggedAt: formatClaimStatsLogDisplayValue_(rowValues[getClaimStatsLogColumnIndex_('LOGGED AT SYDNEY')])
  };
}

function getClaimStatsIntersection_(leftClaims, rightClaims) {
  return Object.keys(leftClaims).filter(function(claimKey) {
    return Boolean(rightClaims[claimKey]);
  }).sort().map(function(claimKey) {
    return rightClaims[claimKey];
  });
}

function claimStatsObjectValues_(claimsByKey) {
  return Object.keys(claimsByKey).sort().map(function(claimKey) {
    return claimsByKey[claimKey];
  });
}

function buildClaimStatsDateKeys_(date) {
  const timezone = CLAIM_STATS_CONFIG.timezone;
  const dateKey = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
  const yearMonth = Utilities.formatDate(date, timezone, 'yyyy-MM');
  const dayOfWeek = Number(Utilities.formatDate(date, timezone, 'u'));
  const monday = new Date(date.getTime() - ((dayOfWeek + 6) % 7) * 24 * 60 * 60 * 1000);

  return {
    loggedAtDisplay: Utilities.formatDate(date, timezone, 'yyyy-MM-dd HH:mm:ss'),
    loggedAtCompact: Utilities.formatDate(date, timezone, 'yyyyMMddHHmmssSSS'),
    dateKey: dateKey,
    weekKey: Utilities.formatDate(monday, timezone, 'yyyy-MM-dd'),
    monthKey: yearMonth
  };
}

function buildClaimStatsRangeDefaults_(date) {
  const dateKeys = buildClaimStatsDateKeys_(date || new Date());
  const weekStartDate = parseClaimStatsDateKey_(dateKeys.weekKey);
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const monthParts = dateKeys.monthKey.split('-').map(function(part) {
    return Number(part);
  });
  const monthStartDate = new Date(monthParts[0], monthParts[1] - 1, 1, 12, 0, 0);
  const monthEndDate = new Date(monthParts[0], monthParts[1], 0, 12, 0, 0);
  const yearStartDate = new Date(monthParts[0], 0, 1, 12, 0, 0);
  const yearEndDate = new Date(monthParts[0], 11, 31, 12, 0, 0);

  return {
    today: {
      fromDateKey: dateKeys.dateKey,
      toDateKey: dateKeys.dateKey
    },
    this_week: {
      fromDateKey: dateKeys.weekKey,
      toDateKey: Utilities.formatDate(weekEndDate, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd')
    },
    this_month: {
      fromDateKey: Utilities.formatDate(monthStartDate, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd'),
      toDateKey: Utilities.formatDate(monthEndDate, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd')
    },
    this_year: {
      fromDateKey: Utilities.formatDate(yearStartDate, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd'),
      toDateKey: Utilities.formatDate(yearEndDate, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd')
    },
    custom: {
      fromDateKey: dateKeys.dateKey,
      toDateKey: dateKeys.dateKey
    },
    all: {
      fromDateKey: '',
      toDateKey: ''
    },
    currentDateKey: dateKeys.dateKey
  };
}

function parseClaimStatsDateKey_(dateKey) {
  const parts = dateKey.split('-').map(function(part) {
    return Number(part);
  });
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function getClaimStatsLogColumnIndex_(headerName) {
  return CLAIM_STATS_CONFIG.logHeaders.indexOf(headerName);
}

function normalizeClaimStatsLogKeyValue_(value, keyColumn) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    if (keyColumn === 'MONTH KEY SYDNEY') {
      return Utilities.formatDate(value, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM');
    }

    return Utilities.formatDate(value, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd');
  }

  return claimStatsString_(value).trim();
}

function formatClaimStatsLogDisplayValue_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CLAIM_STATS_CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');
  }

  return claimStatsString_(value).trim();
}

function claimStatsString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}
