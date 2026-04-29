function onOpen_LegalPortal() {
  SpreadsheetApp.getUi()
    .createMenu('Legal Portal')
    .addItem('Open Review Monitor', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('SidebarUI')
    .setTitle('Review Monitor');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showApprovalModal(reviewKey) {
  const normalizedKey = normalizeReviewKey_(reviewKey);
  const reviewItem = getReviewItem(normalizedKey);

  if (!reviewItem) {
    throw new Error('No review item found for the requested key.');
  }

  const template = HtmlService.createTemplateFromFile('ApprovalModal');
  template.reviewItem = reviewItem;
  template.claim = reviewItem;

  const html = template.evaluate().setWidth(660).setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, '');
}

function approveReview(reviewKey, clientPayload) {
  return finalizeReview_(normalizeReviewKey_(reviewKey), 'approved', clientPayload || {});
}

function denyReview(reviewKey, clientPayload) {
  return finalizeReview_(normalizeReviewKey_(reviewKey), 'denied', clientPayload || {});
}

function finalizeReview_(reviewKey, action, clientPayload) {
  let reviewItem = getReviewItem(reviewKey);
  if (!reviewItem) {
    throw new Error('No review item found for the requested key.');
  }

  if (reviewItem.type === 'calendar') {
    if (action === 'approved') {
      reviewItem = rewriteCalendarReviewRows_(reviewItem, clientPayload);
    } else {
      updateCalendarReviewStatus_(reviewItem.caseNumber, action);
    }
  } else {
    updateStandardReview_(reviewItem, action);
  }

  const payload = buildCallbackPayload_(reviewItem, action, clientPayload);

  try {
    UrlFetchApp.fetch(reviewItem.resumeUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch (error) {
    Logger.log('n8n callback failed for %s review: %s', reviewItem.type, error);
  }

  return {
    ok: true,
    action: action,
    reviewType: reviewItem.type,
    caseNumber: reviewItem.caseNumber || '',
    row: reviewItem.row || null
  };
}

function updateStandardReview_(reviewItem, action) {
  const sheet = getSheetByName_(reviewItem.sourceSheet);

  REVIEW_PORTAL_CONFIG.standardClearColumns.forEach(function(column) {
    sheet.getRange(reviewItem.row, column).clearContent();
  });

  updateSheetStatusCell_(
    sheet,
    reviewItem.row,
    REVIEW_PORTAL_CONFIG.standardColumns.reviewStatus,
    action
  );
}

function updateCalendarReviewStatus_(caseNumber, action) {
  const sheet = getSheetByName_(REVIEW_PORTAL_CONFIG.sheets.calendarStorage);
  const values = sheet.getDataRange().getValues();

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowValues = values[rowIndex];
    if (asString_(getCalendarCellValue_(rowValues, 'caseNumber')) !== caseNumber) {
      continue;
    }

    updateSheetStatusCell_(
      sheet,
      rowIndex + 1,
      REVIEW_PORTAL_CONFIG.calendarColumns.reviewStatus,
      action
    );
  }
}

function rewriteCalendarReviewRows_(reviewItem, clientPayload) {
  const normalizedEvents = normalizeCalendarEventsPayload_(clientPayload && clientPayload.events);
  validateCalendarEvents_(normalizedEvents);

  const sheet = getSheetByName_(REVIEW_PORTAL_CONFIG.sheets.calendarStorage);
  const values = sheet.getDataRange().getValues();
  const matchedRows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowValues = values[rowIndex];
    if (asString_(getCalendarCellValue_(rowValues, 'caseNumber')) === reviewItem.caseNumber) {
      matchedRows.push(rowIndex + 1);
    }
  }

  if (!matchedRows.length) {
    throw new Error('No calendar rows found for case number ' + reviewItem.caseNumber + '.');
  }

  const sortedRows = matchedRows.slice().sort(function(left, right) {
    return left - right;
  });
  const lastMatchedRow = sortedRows[sortedRows.length - 1];

  if (normalizedEvents.length > sortedRows.length) {
    sheet.insertRowsAfter(lastMatchedRow, normalizedEvents.length - sortedRows.length);
    for (let extraIndex = 1; extraIndex <= normalizedEvents.length - sortedRows.length; extraIndex++) {
      sortedRows.push(lastMatchedRow + extraIndex);
    }
  } else if (normalizedEvents.length < sortedRows.length) {
    for (let deleteIndex = sortedRows.length - 1; deleteIndex >= normalizedEvents.length; deleteIndex--) {
      sheet.deleteRow(sortedRows[deleteIndex]);
      sortedRows.pop();
    }
  }

  normalizedEvents.forEach(function(eventItem, index) {
    const rowNumber = sortedRows[index];
    const rowValues = buildCalendarSheetRow_(reviewItem, eventItem, 'Approved');
    sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(rowNumber, REVIEW_PORTAL_CONFIG.calendarColumns.reviewStatus)
      .setBackground(REVIEW_PORTAL_CONFIG.colors.approved);
  });

  const updatedReviewItem = getCalendarReviewItemByCaseNumber_(reviewItem.caseNumber);
  if (!updatedReviewItem) {
    throw new Error('Calendar review could not be reloaded after rewrite.');
  }

  return updatedReviewItem;
}

function buildCalendarSheetRow_(reviewItem, eventItem, reviewStatus) {
  return [
    reviewItem.data.rego || '',
    reviewStatus,
    reviewItem.resumeUrl || '',
    reviewItem.data.caseTitle || '',
    reviewItem.data.caseNumber || '',
    reviewItem.data.courtOrVenue || '',
    reviewItem.data.party1Name || '',
    reviewItem.data.requestStatus || '',
    reviewItem.data.reason || '',
    eventItem.eventType || '',
    eventItem.eventDateTimeSydney || '',
    eventItem.eventDateTimeText || '',
    eventItem.eventBasis || ''
  ];
}

function updateSheetStatusCell_(sheet, row, statusColumn, action) {
  const isApproved = action === 'approved';

  sheet.getRange(row, statusColumn).setValue(isApproved ? 'Approved' : 'Denied');
  sheet.getRange(row, statusColumn).setBackground(
    isApproved ? REVIEW_PORTAL_CONFIG.colors.approved : REVIEW_PORTAL_CONFIG.colors.denied
  );
}

function buildCallbackPayload_(reviewItem, action, clientPayload) {
  const modifiedNotes = typeof clientPayload.modifiedNotes === 'string'
    ? clientPayload.modifiedNotes
    : '';

  if (reviewItem.type === 'calendar') {
    return {
      action: action,
      review_type: 'calendar',
      modified_notes: modifiedNotes,
      calendar_context: {
        rego: reviewItem.data.rego,
        case_title: reviewItem.data.caseTitle,
        case_number: reviewItem.data.caseNumber,
        court_or_venue: reviewItem.data.courtOrVenue,
        party_1_name: reviewItem.data.party1Name,
        status: reviewItem.data.requestStatus,
        reason: reviewItem.data.reason
      },
      calendar_events: reviewItem.data.eventsToNote
    };
  }

  return {
    action: action,
    review_type: 'standard',
    modified_notes: modifiedNotes,
    calendar_context: {},
    calendar_events: []
  };
}

function normalizeReviewKey_(reviewKey) {
  if (typeof reviewKey === 'number' || typeof reviewKey === 'string') {
    return {
      type: 'standard',
      row: Number(reviewKey),
      sheetName: getActiveSheet_().getName()
    };
  }

  if (!reviewKey || !reviewKey.type) {
    throw new Error('A valid review key is required.');
  }

  return {
    type: reviewKey.type,
    row: reviewKey.row ? Number(reviewKey.row) : null,
    caseNumber: reviewKey.caseNumber ? String(reviewKey.caseNumber) : '',
    sheetName: reviewKey.sheetName || getActiveSheet_().getName()
  };
}

function normalizeCalendarEventsPayload_(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.map(function(eventItem) {
    const localValue = asString_(eventItem && eventItem.eventDateTimeLocal).trim();
    return {
      eventType: asString_(eventItem && eventItem.eventType).trim(),
      eventDateTimeLocal: localValue,
      eventDateTimeSydney: convertSydneyLocalInputToIso_(localValue),
      eventDateTimeText: asString_(eventItem && eventItem.eventDateTimeText).trim(),
      eventBasis: asString_(eventItem && eventItem.eventBasis).trim()
    };
  });
}

function validateCalendarEvents_(events) {
  if (!events.length) {
    throw new Error('At least one calendar event is required before approval.');
  }

  events.forEach(function(eventItem, index) {
    const label = 'Event ' + (index + 1);
    if (!eventItem.eventType) {
      throw new Error(label + ' is missing an event type.');
    }
    if (!eventItem.eventDateTimeLocal || !eventItem.eventDateTimeSydney) {
      throw new Error(label + ' is missing a valid Sydney datetime.');
    }
  });
}

function convertSydneyLocalInputToIso_(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const offsetMinutes = isSydneyDaylightSavingLocal_(year, month, day, hour)
    ? 11 * 60
    : 10 * 60;
  const offsetHours = Math.floor(offsetMinutes / 60);
  const offsetText = (offsetHours >= 0 ? '+' : '-') + padNumber_(Math.abs(offsetHours), 2) + ':00';

  return [
    year,
    '-',
    padNumber_(month, 2),
    '-',
    padNumber_(day, 2),
    'T',
    padNumber_(hour, 2),
    ':',
    padNumber_(minute, 2),
    ':00',
    offsetText
  ].join('');
}

function isSydneyDaylightSavingLocal_(year, month, day, hour) {
  if (month < 4 || month > 10) {
    return true;
  }

  if (month > 4 && month < 10) {
    return false;
  }

  if (month === 10) {
    const startDay = firstSundayOfMonth_(year, 10);
    if (day > startDay) {
      return true;
    }
    if (day < startDay) {
      return false;
    }
    return hour >= 2;
  }

  const endDay = firstSundayOfMonth_(year, 4);
  if (day < endDay) {
    return true;
  }
  if (day > endDay) {
    return false;
  }
  return hour < 3;
}

function firstSundayOfMonth_(year, month) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const weekday = firstDay.getUTCDay();
  return weekday === 0 ? 1 : 8 - weekday;
}

function padNumber_(value, length) {
  let text = String(value);
  while (text.length < length) {
    text = '0' + text;
  }
  return text;
}
