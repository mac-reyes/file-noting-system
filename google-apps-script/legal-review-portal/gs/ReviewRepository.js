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
    emailDate: 57
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
      emptyMessage: 'Calendar storage tab does not display review items.'
    };
  }

  if (activeSheetName === REVIEW_PORTAL_CONFIG.sheets.mixedReview) {
    return {
      items: getPendingStandardItemsFromSheet_(activeSheet).concat(getPendingCalendarItems_()),
      emptyMessage: 'No pending reviews.'
    };
  }

  if (isStandardOnlySheet_(activeSheetName)) {
    return {
      items: getPendingStandardItemsFromSheet_(activeSheet),
      emptyMessage: 'No pending reviews.'
    };
  }

  return {
    items: [],
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

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowNumber = rowIndex + 1;
    const rowValues = values[rowIndex];

    if (getStandardCellValue_(rowValues, 'reviewStatus') !== 'Awaiting Review') {
      continue;
    }

    const reviewItem = extractStandardReview(rowValues, rowNumber, sheet.getName());
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
  const rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];

  return extractStandardReview(rowValues, row, sheet.getName());
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

function getStandardCellValue_(rowValues, key) {
  return rowValues[getStandardColumnIndex_(key)];
}

function getCalendarColumnIndex_(key) {
  return REVIEW_PORTAL_CONFIG.calendarColumns[key] - 1;
}

function getCalendarCellValue_(rowValues, key) {
  return rowValues[getCalendarColumnIndex_(key)];
}
