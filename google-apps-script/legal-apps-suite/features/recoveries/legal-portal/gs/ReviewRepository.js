const REVIEW_PORTAL_CONFIG = {
  timezone: 'Australia/Sydney',
  refreshIntervalMs: 3500,
  sheets: {
    mixedReview: 'Liability',
    calendarStorage: 'Calendar Events',
    standardOnly: ['Nat', 'Cherie', 'Angelene', 'Tina', 'NRMA/Justin']
  },
  standardColumns: {
    rego: 2,
    reviewStatus: 53,
    resumeUrl: 54,
    aiNotes: 55,
    aiSummary: 56,
    emailDate: 57,
    dateClaimReceived: 12
  },
  standardHeaderNames: {
    rego: ['REGO'],
    reviewStatus: ['REVIEW STATUS'],
    resumeUrl: ['RESUME URL'],
    aiNotes: ['PENDING AI NOTES'],
    aiSummary: ['AI SUMMARY'],
    emailDate: ['EMAIL RECEIVED DATE'],
    dateClaimReceived: ['DATE CLAIM RECEIVED', 'DATE CLAIM RECIEVED']
  },
  standardClearColumns: [54, 55, 56],
  calendarColumns: {
    rego: 1,
    reviewStatus: 2,
    resumeUrl: 3,
    caseTitle: 4,
    caseNumber: 5,
    courtOrVenue: 6,
    party1Name: 7,
    requestStatus: 8,
    reason: 9,
    eventType: 10,
    eventDateTimeSydney: 11,
    eventDateTimeText: 12,
    eventBasis: 13
  },
  colors: {
    approved: '#d9ead3',
    denied: '#f4cccc'
  }
};

function getPendingReviewItems() {
  const activeSheet = getActiveSheet_();
  const activeSheetName = activeSheet.getName();

  if (activeSheetName === REVIEW_PORTAL_CONFIG.sheets.calendarStorage) {
    return {
      items: [],
      summaryMode: 'none',
      emptyMessage: 'Calendar storage tab does not display review items.'
    };
  }

  if (activeSheetName === REVIEW_PORTAL_CONFIG.sheets.mixedReview) {
    return {
      items: sortPendingReviewItems_(
        getPendingStandardItemsFromSheet_(activeSheet).concat(getPendingCalendarItems_())
      ),
      summaryMode: 'mixed',
      emptyMessage: 'No pending reviews.'
    };
  }

  if (isStandardOnlySheet_(activeSheetName)) {
    return {
      items: sortPendingReviewItems_(getPendingStandardItemsFromSheet_(activeSheet)),
      summaryMode: 'standard',
      emptyMessage: 'No pending reviews.'
    };
  }

  return {
    items: [],
    summaryMode: 'none',
    emptyMessage: 'This tab does not display review items.'
  };
}

function getReviewItem(reviewKey) {
  if (!reviewKey || !reviewKey.type) {
    return null;
  }

  if (reviewKey.type === 'calendar') {
    return getCalendarReviewItemByCaseNumber_(reviewKey.caseNumber);
  }

  return getStandardReviewItemByRow_(reviewKey.sheetName, Number(reviewKey.row));
}

function getActiveSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
}

function getSheetByName_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" was not found.');
  }

  return sheet;
}

function isStandardOnlySheet_(sheetName) {
  return REVIEW_PORTAL_CONFIG.sheets.standardOnly.indexOf(sheetName) !== -1;
}

function getPendingStandardItemsFromSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  const items = [];
  const headerContext = buildStandardHeaderContext_(values[0] || []);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowNumber = rowIndex + 1;
    const rowValues = values[rowIndex];

    if (asString_(getStandardCellValue_(rowValues, 'reviewStatus', headerContext)).trim() !== 'Awaiting Review') {
      continue;
    }

    const reviewItem = extractStandardReview(rowValues, rowNumber, sheet.getName(), headerContext);
    if (reviewItem) {
      items.push(reviewItem);
    }
  }

  return items;
}

function getStandardReviewItemByRow_(sheetName, row) {
  if (!row || row < 2) {
    return null;
  }

  const sheet = getSheetByName_(sheetName || REVIEW_PORTAL_CONFIG.sheets.mixedReview);
  const lastColumn = sheet.getLastColumn();
  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
  const headerContext = buildStandardHeaderContext_(headerValues);

  return extractStandardReview(rowValues, row, sheet.getName(), headerContext);
}

function getPendingCalendarItems_() {
  const sheet = getSheetByName_(REVIEW_PORTAL_CONFIG.sheets.calendarStorage);
  const values = sheet.getDataRange().getValues();
  const groupedRows = {};

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowNumber = rowIndex + 1;
    const rowValues = values[rowIndex];
    const reviewStatus = getCalendarCellValue_(rowValues, 'reviewStatus');
    const caseNumber = asString_(getCalendarCellValue_(rowValues, 'caseNumber'));

    if (reviewStatus !== 'Awaiting Review' || !caseNumber) {
      continue;
    }

    if (!groupedRows[caseNumber]) {
      groupedRows[caseNumber] = [];
    }

    groupedRows[caseNumber].push({
      rowNumber: rowNumber,
      rowValues: rowValues
    });
  }

  return Object.keys(groupedRows).sort().map(function(caseNumber) {
    return extractCalendarReview(groupedRows[caseNumber]);
  }).filter(Boolean);
}

function getCalendarReviewItemByCaseNumber_(caseNumber) {
  if (!caseNumber) {
    return null;
  }

  const sheet = getSheetByName_(REVIEW_PORTAL_CONFIG.sheets.calendarStorage);
  const values = sheet.getDataRange().getValues();
  const groupedRows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowValues = values[rowIndex];
    if (asString_(getCalendarCellValue_(rowValues, 'caseNumber')) === String(caseNumber)) {
      groupedRows.push({
        rowNumber: rowIndex + 1,
        rowValues: rowValues
      });
    }
  }

  if (!groupedRows.length) {
    return null;
  }

  return extractCalendarReview(groupedRows);
}

function getStandardColumnIndex_(key) {
  return REVIEW_PORTAL_CONFIG.standardColumns[key] - 1;
}

function getStandardCellValue_(rowValues, key, headerContext) {
  const headerIndex = headerContext && headerContext[key];
  if (typeof headerIndex === 'number' && headerIndex >= 0) {
    return rowValues[headerIndex];
  }

  return rowValues[getStandardColumnIndex_(key)];
}

function getCalendarColumnIndex_(key) {
  return REVIEW_PORTAL_CONFIG.calendarColumns[key] - 1;
}

function getCalendarCellValue_(rowValues, key) {
  return rowValues[getCalendarColumnIndex_(key)];
}

function buildStandardHeaderContext_(headerValues) {
  const normalizedHeaderMap = {};
  const headerContext = {};

  (headerValues || []).forEach(function(headerValue, index) {
    const normalizedHeader = normalizeHeader_(headerValue);
    if (normalizedHeader && normalizedHeaderMap[normalizedHeader] === undefined) {
      normalizedHeaderMap[normalizedHeader] = index;
    }
  });

  Object.keys(REVIEW_PORTAL_CONFIG.standardHeaderNames).forEach(function(key) {
    const names = REVIEW_PORTAL_CONFIG.standardHeaderNames[key] || [];
    for (let index = 0; index < names.length; index++) {
      const normalizedName = normalizeHeader_(names[index]);
      if (normalizedHeaderMap[normalizedName] !== undefined) {
        headerContext[key] = normalizedHeaderMap[normalizedName];
        return;
      }
    }
  });

  return headerContext;
}

function normalizeHeader_(value) {
  return asString_(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function sortPendingReviewItems_(items) {
  return items.slice().sort(function(left, right) {
    const leftRank = getReviewSortRank_(left);
    const rightRank = getReviewSortRank_(right);

    if (leftRank.bucket !== rightRank.bucket) {
      return leftRank.bucket - rightRank.bucket;
    }

    if (leftRank.dateKey !== rightRank.dateKey) {
      return leftRank.dateKey - rightRank.dateKey;
    }

    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function getReviewSortRank_(item) {
  if (!item || item.type !== 'standard' || !item.dueStatus || !item.dueStatus.dateKey) {
    return {
      bucket: 4,
      dateKey: Number.MAX_SAFE_INTEGER
    };
  }

  const bucketByStatus = {
    overdue: 0,
    dueToday: 1,
    warning: 2,
    neutral: 3,
    muted: 4
  };

  return {
    bucket: bucketByStatus[item.dueStatus.state] === undefined ? 4 : bucketByStatus[item.dueStatus.state],
    dateKey: item.dueStatus.dateKey
  };
}
