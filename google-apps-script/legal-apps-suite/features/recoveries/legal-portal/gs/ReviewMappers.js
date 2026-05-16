function extractStandardReview(rowValues, rowNumber, sheetName, headerContext) {
  const rego = asString_(getStandardCellValue_(rowValues, 'rego', headerContext));
  const resumeUrl = asString_(getStandardCellValue_(rowValues, 'resumeUrl', headerContext));
  const emailDate = getStandardCellValue_(rowValues, 'emailDate', headerContext);
  const dueStatus = buildStandardReviewDueStatus_(emailDate);
  const emailDateText = formatSheetDate_(getStandardCellValue_(rowValues, 'emailDate', headerContext));
  const claimReceivedText = formatSheetDate_(getStandardCellValue_(rowValues, 'dateClaimReceived', headerContext));

  if (!resumeUrl) {
    Logger.log('Skipping standard review row %s on %s because resume URL is blank.', rowNumber, sheetName);
    return null;
  }

  return {
    row: rowNumber,
    caseNumber: '',
    sourceSheet: sheetName,
    type: 'standard',
    reviewStatus: asString_(getStandardCellValue_(rowValues, 'reviewStatus', headerContext)),
    title: rego || 'Row ' + rowNumber,
    subtitle: dueStatus.label || emailDateText || 'Awaiting Review',
    resumeUrl: resumeUrl,
    dueStatus: dueStatus,
    reviewKey: {
      type: 'standard',
      row: rowNumber,
      sheetName: sheetName
    },
    data: {
      rego: rego,
      aiNotes: asString_(getStandardCellValue_(rowValues, 'aiNotes', headerContext)),
      aiSummary: asString_(getStandardCellValue_(rowValues, 'aiSummary', headerContext)),
      reviewDueDateText: dueStatus.dateText,
      emailDateText: emailDateText,
      claimReceivedText: claimReceivedText
    }
  };
}

function extractCalendarReview(groupedRows) {
  if (!groupedRows || !groupedRows.length) {
    return null;
  }

  const firstRow = groupedRows[0].rowValues;
  const caseNumber = asString_(getCalendarCellValue_(firstRow, 'caseNumber'));
  const resumeUrl = asString_(getCalendarCellValue_(firstRow, 'resumeUrl'));

  if (!caseNumber || !resumeUrl) {
    Logger.log('Skipping calendar review for case "%s" because required fields are missing.', caseNumber || '(blank)');
    return null;
  }

  const seenEvents = {};
  const events = [];

  groupedRows.forEach(function(groupedRow) {
    const rowValues = groupedRow.rowValues;
    const event = {
      eventType: asString_(getCalendarCellValue_(rowValues, 'eventType')),
      eventDateTimeSydney: asString_(getCalendarCellValue_(rowValues, 'eventDateTimeSydney')),
      eventDateTimeText: asString_(getCalendarCellValue_(rowValues, 'eventDateTimeText')),
      eventBasis: asString_(getCalendarCellValue_(rowValues, 'eventBasis'))
    };
    const eventKey = [
      event.eventType,
      event.eventDateTimeSydney,
      event.eventDateTimeText
    ].join('|');

    if (!seenEvents[eventKey]) {
      seenEvents[eventKey] = true;
      events.push(event);
    }
  });

  events.sort(function(left, right) {
    return left.eventDateTimeSydney.localeCompare(right.eventDateTimeSydney);
  });

  return {
    row: null,
    caseNumber: caseNumber,
    sourceSheet: REVIEW_PORTAL_CONFIG.sheets.calendarStorage,
    type: 'calendar',
    reviewStatus: asString_(getCalendarCellValue_(firstRow, 'reviewStatus')),
    title: asString_(getCalendarCellValue_(firstRow, 'caseTitle')) || 'Calendar Review',
    subtitle: asString_(getCalendarCellValue_(firstRow, 'courtOrVenue')) || 'Calendar Review',
    resumeUrl: resumeUrl,
    reviewKey: {
      type: 'calendar',
      caseNumber: caseNumber,
      sheetName: REVIEW_PORTAL_CONFIG.sheets.calendarStorage
    },
    data: {
      rego: asString_(getCalendarCellValue_(firstRow, 'rego')),
      caseTitle: asString_(getCalendarCellValue_(firstRow, 'caseTitle')),
      caseNumber: caseNumber,
      courtOrVenue: asString_(getCalendarCellValue_(firstRow, 'courtOrVenue')),
      party1Name: asString_(getCalendarCellValue_(firstRow, 'party1Name')),
      requestStatus: asString_(getCalendarCellValue_(firstRow, 'requestStatus')),
      reason: asString_(getCalendarCellValue_(firstRow, 'reason')),
      eventsToNote: events
    }
  };
}

function buildStandardReviewDueStatus_(value) {
  const receivedDate = parseSheetDateTime_(value) || parseSheetDateOnly_(value);
  const dueDate = addCalendarDays_(receivedDate, 7);
  if (!dueDate) {
    return {
      state: 'muted',
      label: 'No due date',
      dateText: asString_(value).trim(),
      daysUntil: null,
      dateKey: null
    };
  }

  const today = getTodayDateOnly_();
  const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  let state = 'neutral';
  let label = 'Due ' + formatDateOnly_(dueDate);

  if (daysUntil < 0) {
    state = 'overdue';
    label = 'Past due by ' + Math.abs(daysUntil) + ' day' + (Math.abs(daysUntil) === 1 ? '' : 's');
  } else if (daysUntil === 0) {
    state = 'dueToday';
    label = 'Due today';
  } else if (daysUntil <= 4) {
    state = 'warning';
    label = 'Due in ' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's');
  }

  return {
    state: state,
    label: label,
    dateText: formatDateOnly_(dueDate),
    daysUntil: daysUntil,
    dateKey: Number(Utilities.formatDate(dueDate, REVIEW_PORTAL_CONFIG.timezone, 'yyyyMMdd'))
  };
}

function formatSheetDate_(value) {
  const parsedDate = parseSheetDateTime_(value) || parseSheetDateOnly_(value);
  if (!parsedDate) {
    return asString_(value).trim();
  }

  return Utilities.formatDate(parsedDate, REVIEW_PORTAL_CONFIG.timezone, 'MMM dd yyyy hh:mm a');
}

function formatDateOnly_(value) {
  return Utilities.formatDate(value, REVIEW_PORTAL_CONFIG.timezone, 'MMM dd yyyy');
}

function getTodayDateOnly_() {
  const todayKey = Utilities.formatDate(new Date(), REVIEW_PORTAL_CONFIG.timezone, 'yyyy-MM-dd');
  return parseIsoDateOnly_(todayKey);
}

function parseSheetDateTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  const text = asString_(value).trim();
  const dateTimeMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dateTimeMatch) {
    return null;
  }

  return new Date(
    Number(dateTimeMatch[1]),
    Number(dateTimeMatch[2]) - 1,
    Number(dateTimeMatch[3]),
    Number(dateTimeMatch[4]),
    Number(dateTimeMatch[5]),
    Number(dateTimeMatch[6] || 0)
  );
}

function parseSheetDateOnly_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = asString_(value).trim();
  if (!text) {
    return null;
  }

  return parseIsoDateOnly_(text) ||
    parseNamedMonthDate_(text) ||
    parseSlashDate_(text);
}

function parseIsoDateOnly_(text) {
  const match = asString_(text).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseNamedMonthDate_(text) {
  const match = asString_(text).trim().match(/^(\d{1,2})[\s/-]([A-Za-z]{3,9})[\s/-](\d{2,4})$/);
  if (!match) {
    return null;
  }

  const monthIndex = getMonthIndex_(match[2]);
  if (monthIndex < 0) {
    return null;
  }

  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }

  return new Date(year, monthIndex, Number(match[1]));
}

function parseSlashDate_(text) {
  const match = asString_(text).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }

  return new Date(year, Number(match[2]) - 1, Number(match[1]));
}

function getMonthIndex_(monthText) {
  const monthKey = asString_(monthText).trim().slice(0, 3).toLowerCase();
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return monthKeys.indexOf(monthKey);
}

function addCalendarDays_(value, days) {
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    return null;
  }

  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function asString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}
