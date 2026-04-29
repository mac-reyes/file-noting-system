const CLAIM_STATS_CONFIG = {
  logSheetName: '_Claim Stats Log',
  sourceSheetName: 'Liability',
  timezone: 'Australia/Sydney',
  sectionLabels: {
    newClaims: 'NEW CLAIMS',
    liabilityConfirmed: 'LIABILITY CONFIRMED'
  },
  headers: {
    claimNumber: 'CLAIM NUMBER',
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
    'CLAIM NUMBER',
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
    newClaim: 'NEW_CLAIM',
    liabilityConfirmed: 'LIABILITY_CONFIRMED'
  }
};

function onOpen_ClaimStatistics() {
  SpreadsheetApp.getUi()
    .createMenu('Analytics')
    .addItem('Open Claim Statistics', 'showClaimStatsModal')
    .addSeparator()
    .addItem('Diagnostics', 'showClaimStatsDiagnostics')
    .addToUi();
}

function showClaimStatsDiagnostics() {
  try {
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
    const report = getClaimStatsReport('day', '');
    const template = HtmlService.createTemplateFromFile('ClaimStatsModal');
    template.report = report;

    const html = template.evaluate().setWidth(700).setHeight(780);
    SpreadsheetApp.getUi().showModalDialog(html, 'Claim Statistics');
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Claim Statistics Error',
      error && error.message ? error.message : String(error),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function getClaimStatsReport(period, anchorDateKey) {
  const result = refreshClaimStatsLog_();
  return buildClaimStatsReport_(period || 'day', result.loggedAt, anchorDateKey || '');
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
      return {
        initialized: true,
        loggedAt: now
      };
    }

    appendClaimStatsEventRows_(logSheet, snapshot, logState, dateKeys);
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
    newClaims: extractClaimStatsRows_(values, sheet.getName(), sections.newClaims, headerIndexes),
    liabilityConfirmed: extractClaimStatsRows_(values, sheet.getName(), sections.liabilityConfirmed, headerIndexes)
  };
}

function getClaimStatsHeaderIndexes_(headerRow) {
  const normalizedHeaders = headerRow.map(function(value) {
    return normalizeClaimStatsHeader_(value);
  });

  return {
    claimNumber: getClaimStatsHeaderIndex_(normalizedHeaders, CLAIM_STATS_CONFIG.headers.claimNumber),
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
  const newClaimRows = [];
  const liabilityConfirmedRows = [];

  values.forEach(function(rowValues, rowIndex) {
    const label = claimStatsString_(rowValues[0]).trim();
    if (label === CLAIM_STATS_CONFIG.sectionLabels.newClaims) {
      newClaimRows.push(rowIndex + 1);
    }

    if (label === CLAIM_STATS_CONFIG.sectionLabels.liabilityConfirmed) {
      liabilityConfirmedRows.push(rowIndex + 1);
    }
  });

  validateClaimStatsSectionRows_(newClaimRows, CLAIM_STATS_CONFIG.sectionLabels.newClaims);
  validateClaimStatsSectionRows_(liabilityConfirmedRows, CLAIM_STATS_CONFIG.sectionLabels.liabilityConfirmed);

  if (newClaimRows[0] >= liabilityConfirmedRows[0]) {
    throw new Error(
      '"' + CLAIM_STATS_CONFIG.sectionLabels.newClaims + '" must appear before "' +
      CLAIM_STATS_CONFIG.sectionLabels.liabilityConfirmed + '" in column A.'
    );
  }

  return {
    newClaims: {
      label: CLAIM_STATS_CONFIG.sectionLabels.newClaims,
      startRow: newClaimRows[0] + 1,
      endRow: liabilityConfirmedRows[0] - 1
    },
    liabilityConfirmed: {
      label: CLAIM_STATS_CONFIG.sectionLabels.liabilityConfirmed,
      startRow: liabilityConfirmedRows[0] + 1,
      endRow: values.length
    }
  };
}

function validateClaimStatsSectionRows_(sectionRows, label) {
  if (!sectionRows.length) {
    throw new Error('Section label "' + label + '" was not found exactly in column A.');
  }

  if (sectionRows.length > 1) {
    throw new Error('Section label "' + label + '" appears more than once in column A.');
  }
}

function extractClaimStatsRows_(values, sheetName, section, headerIndexes) {
  const rowsByClaimKey = {};

  for (let rowNumber = section.startRow; rowNumber <= section.endRow; rowNumber++) {
    const rowValues = values[rowNumber - 1];
    if (!rowValues || isClaimStatsBlankRow_(rowValues)) {
      continue;
    }

    const claimNumber = claimStatsString_(rowValues[headerIndexes.claimNumber]).trim();
    const rego = claimStatsString_(rowValues[headerIndexes.rego]).trim();
    const claimKey = buildClaimStatsKey_(claimNumber, rego);

    if (!claimKey) {
      continue;
    }

    if (!rowsByClaimKey[claimKey]) {
      rowsByClaimKey[claimKey] = {
        claimKey: claimKey,
        claimNumber: claimNumber,
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

function buildClaimStatsKey_(claimNumber, rego) {
  const normalizedClaimNumber = normalizeClaimStatsKeyPart_(claimNumber);
  const normalizedRego = normalizeClaimStatsKeyPart_(rego);

  if (!normalizedClaimNumber || !normalizedRego) {
    return '';
  }

  return normalizedClaimNumber + '|' + normalizedRego;
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
    newClaimKeys: {},
    liabilityConfirmedKeys: {},
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
      claimNumber: '',
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
    claim.claimNumber,
    claim.rego,
    claim.clientName,
    claim.insurer,
    claim.sourceSheet,
    claim.sourceSection,
    claim.sourceRow
  ];
}

function buildClaimStatsReport_(period, now, anchorDateKey) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ensureClaimStatsLogSheet_(spreadsheet);
  const dateKeys = buildClaimStatsDateKeys_(now || new Date());
  const anchorKeys = buildClaimStatsAnchorDateKeys_(anchorDateKey, now || new Date());
  const periodConfig = getClaimStatsPeriodConfig_(period, anchorKeys);
  const rows = getClaimStatsLogValues_(logSheet);
  const reportRows = rows.filter(function(rowValues) {
    return isClaimStatsRowInPeriod_(rowValues, periodConfig);
  });
  const grouped = groupClaimStatsReportRows_(reportRows);
  const samePeriodClaims = getClaimStatsIntersection_(grouped.newClaims, grouped.liabilityConfirmed);
  const newClaims = claimStatsObjectValues_(grouped.newClaims);
  const liabilityConfirmed = claimStatsObjectValues_(grouped.liabilityConfirmed);

  return {
    title: 'Claim Statistics - ' + periodConfig.label,
    badge: 'Claim Statistics',
    subtitle: periodConfig.rangeLabel + ' - ' + CLAIM_STATS_CONFIG.timezone,
    period: periodConfig.period,
    anchorDateKey: anchorKeys.dateKey,
    rangeLabel: periodConfig.rangeLabel,
    filterLabel: periodConfig.keyColumn
      ? periodConfig.keyColumn + ' = ' + periodConfig.keyValue
      : 'All non-baseline events',
    lastScanned: dateKeys.loggedAtDisplay,
    totals: {
      newClaims: newClaims.length,
      liabilityConfirmed: liabilityConfirmed.length,
      samePeriodConfirmed: samePeriodClaims.length
    },
    sections: {
      newClaims: newClaims,
      liabilityConfirmed: liabilityConfirmed,
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

  return {
    title: 'Claim Statistics Diagnostics',
    lastScanned: dateKeys.loggedAtDisplay,
    currentScan: {
      newClaimsRows: snapshot.newClaims.length,
      liabilityConfirmedRows: snapshot.liabilityConfirmed.length
    },
    logSummary: {
      totalRows: rows.length,
      reportableEvents: newClaimCount + liabilityConfirmedCount
    },
    eventCounts: {
      baselineNewClaim: counts[CLAIM_STATS_CONFIG.eventTypes.baselineNewClaim] || 0,
      baselineLiabilityConfirmed: counts[CLAIM_STATS_CONFIG.eventTypes.baselineLiabilityConfirmed] || 0,
      newClaim: newClaimCount,
      liabilityConfirmed: liabilityConfirmedCount
    },
    recentRows: lastRows
  };
}

function getClaimStatsPeriodConfig_(period, dateKeys) {
  if (period === 'all') {
    return {
      period: 'all',
      label: 'All Logged Activity',
      keyColumn: '',
      keyValue: '',
      rangeLabel: 'All non-baseline log events'
    };
  }

  if (period === 'day' || period === 'today') {
    return {
      period: 'day',
      label: 'Daily Report',
      keyColumn: 'DATE KEY SYDNEY',
      keyValue: dateKeys.dateKey,
      rangeLabel: dateKeys.dateKey
    };
  }

  if (period === 'week') {
    return {
      period: 'week',
      label: 'Weekly Report',
      keyColumn: 'WEEK KEY SYDNEY',
      keyValue: dateKeys.weekKey,
      rangeLabel: 'Week of ' + dateKeys.weekKey
    };
  }

  if (period === 'month') {
    return {
      period: 'month',
      label: 'Monthly Report',
      keyColumn: 'MONTH KEY SYDNEY',
      keyValue: dateKeys.monthKey,
      rangeLabel: dateKeys.monthKey
    };
  }

  throw new Error('Unsupported claim statistics period "' + period + '".');
}

function isClaimStatsRowInPeriod_(rowValues, periodConfig) {
  const eventType = claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('EVENT TYPE')]);
  const isReportableEvent = (
    eventType === CLAIM_STATS_CONFIG.eventTypes.newClaim ||
    eventType === CLAIM_STATS_CONFIG.eventTypes.liabilityConfirmed
  );

  if (!isReportableEvent) {
    return false;
  }

  if (!periodConfig.keyColumn) {
    return true;
  }

  const keyValue = normalizeClaimStatsLogKeyValue_(
    rowValues[getClaimStatsLogColumnIndex_(periodConfig.keyColumn)],
    periodConfig.keyColumn
  );

  return keyValue === periodConfig.keyValue;
}

function groupClaimStatsReportRows_(rows) {
  const grouped = {
    newClaims: {},
    liabilityConfirmed: {}
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
  });

  return grouped;
}

function buildClaimStatsReportClaim_(rowValues) {
  return {
    claimKey: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('CLAIM KEY')]),
    claimNumber: claimStatsString_(rowValues[getClaimStatsLogColumnIndex_('CLAIM NUMBER')]),
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

function buildClaimStatsAnchorDateKeys_(anchorDateKey, fallbackDate) {
  const normalizedDateKey = claimStatsString_(anchorDateKey).trim();

  if (normalizedDateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateKey)) {
      throw new Error('Report date must use yyyy-MM-dd format.');
    }

    const dateParts = normalizedDateKey.split('-').map(function(part) {
      return Number(part);
    });
    const anchorDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 12, 0, 0);
    return buildClaimStatsDateKeys_(anchorDate);
  }

  return buildClaimStatsDateKeys_(fallbackDate || new Date());
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
