function extractStandardReview(rowValues, rowNumber, sheetName) {
  const rego = asString_(getStandardCellValue_(rowValues, 'rego'));
  const resumeUrl = asString_(getStandardCellValue_(rowValues, 'resumeUrl'));

  if (!resumeUrl) {
    Logger.log('Skipping standard review row %s on %s because resume URL is blank.', rowNumber, sheetName);
    return null;
  }

  return {
    row: rowNumber,
    caseNumber: '',
    sourceSheet: sheetName,
    type: 'standard',
    reviewStatus: asString_(getStandardCellValue_(rowValues, 'reviewStatus')),
    title: rego || 'Row ' + rowNumber,
    subtitle: formatSheetDate_(getStandardCellValue_(rowValues, 'emailDate')) || 'Awaiting Review',
    resumeUrl: resumeUrl,
    reviewKey: {
      type: 'standard',
      row: rowNumber,
      sheetName: sheetName
    },
    data: {
      rego: rego,
      aiNotes: asString_(getStandardCellValue_(rowValues, 'aiNotes')),
      aiSummary: asString_(getStandardCellValue_(rowValues, 'aiSummary')),
      emailDateText: formatSheetDate_(getStandardCellValue_(rowValues, 'emailDate'))
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

function formatSheetDate_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    return '';
  }

  return Utilities.formatDate(value, REVIEW_PORTAL_CONFIG.timezone, 'MMM dd yyyy hh:mm a');
}

function asString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}
