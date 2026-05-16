/**
 * Money Talks settlement release document generator.
 */

const MONEY_TALKS_SETTLEMENT_RELEASE_TEMPLATE_ID = 'REDACTED_DRIVE_ID';

const MONEY_TALKS_SETTLEMENT_RELEASE_COLUMNS = {
  column_c: 'C', // Authoriser / Repairer
  column_d: 'D', // Client registration
  column_e: 'E', // Third party insurer
  column_g: 'G', // GST Status
  column_h: 'H', // Description (For filename & fallback)
  column_i: 'I', // Settlement total (note contains breakdown)
  column_k: 'K', // ISP Fee
  column_l: 'L', // Quotation Fee
  column_m: 'M', // RMS Fee
  column_n: 'N', // Legal Costs
  column_o: 'O', // Assessment Fee
  column_p: 'P', // Other
  column_q: 'Q', // Total Remaining Balance
  column_r: 'R', // Total Due
  column_s: 'S', // ISP Profit
  column_v: 'V'  // Date of loss
};

function generateMoneyTalksSettlementRelease() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();

  if (range.getNumRows() !== 1) {
    SpreadsheetApp.getUi().alert('Please select exactly one row.');
    return;
  }

  const row = range.getRow();
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columns = MONEY_TALKS_SETTLEMENT_RELEASE_COLUMNS;
  const noteContent = sheet.getRange(row, moneyTalksColumnLetterToIndex_(columns.column_i) + 1).getNote();
  const breakdownItems = moneyTalksParseNoteToItems_(noteContent);

  if (breakdownItems.length === 0) {
    const description = rowData[moneyTalksColumnLetterToIndex_(columns.column_h)];
    const total = rowData[moneyTalksColumnLetterToIndex_(columns.column_i)];
    breakdownItems.push({
      key: description || 'Settlement Amount',
      value: total || 0
    });
  }

  const rego = rowData[moneyTalksColumnLetterToIndex_(columns.column_d)];
  const gstStatus = rowData[moneyTalksColumnLetterToIndex_(columns.column_g)];
  const description = rowData[moneyTalksColumnLetterToIndex_(columns.column_h)];
  const docTitle = 'Settlement Release - ' + rego + ' (' + gstStatus + ' GST) ' + description;

  const copy = DriveApp.getFileById(MONEY_TALKS_SETTLEMENT_RELEASE_TEMPLATE_ID).makeCopy(docTitle);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach(function(suffix, index) {
    const keyPlaceholder = '{{column_key_' + suffix + '}}';
    const valuePlaceholder = '{{column_value_' + suffix + '}}';

    if (index < breakdownItems.length) {
      body.replaceText(keyPlaceholder, breakdownItems[index].key);
      body.replaceText(valuePlaceholder, moneyTalksFormatAsCurrency_(breakdownItems[index].value));
    } else {
      moneyTalksDeleteRowByPlaceholder_(body, keyPlaceholder);
    }
  });

  const feePlaceholders = {
    '{{column_k}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_k)],
    '{{column_l}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_l)],
    '{{column_m}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_m)],
    '{{column_o}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_o)],
    '{{column_n}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_n)],
    '{{column_p}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_p)]
  };

  Object.keys(feePlaceholders).forEach(function(placeholder) {
    const value = feePlaceholders[placeholder];
    const numericValue = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
    if (isNaN(numericValue) || numericValue === 0) {
      moneyTalksDeleteRowByPlaceholder_(body, placeholder);
      Logger.log(placeholder + '-');
      return;
    }

    body.replaceText(placeholder, moneyTalksFormatAsCurrency_(value));
    Logger.log(placeholder + ' ' + value);
  });

  const dateOfLoss = rowData[moneyTalksColumnLetterToIndex_(columns.column_v)];
  const standardMappings = {
    '{{column_c}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_c)],
    '{{column_d}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_d)],
    '{{column_e}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_e)],
    '{{column_g}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_g)],
    '{{column_h}}': rowData[moneyTalksColumnLetterToIndex_(columns.column_h)],
    '{{column_i}}': moneyTalksFormatAsCurrency_(rowData[moneyTalksColumnLetterToIndex_(columns.column_i)]),
    '{{column_q}}': moneyTalksFormatAsCurrency_(rowData[moneyTalksColumnLetterToIndex_(columns.column_q)]),
    '{{column_r}}': moneyTalksFormatAsCurrency_(rowData[moneyTalksColumnLetterToIndex_(columns.column_r)]),
    '{{column_s}}': moneyTalksFormatAsCurrency_(rowData[moneyTalksColumnLetterToIndex_(columns.column_s)]),
    '{{column_v}}': dateOfLoss instanceof Date ? moneyTalksFormatNumericalDate_(dateOfLoss) : dateOfLoss
  };

  Object.keys(standardMappings).forEach(function(placeholder) {
    body.replaceText(placeholder, standardMappings[placeholder] || '');
  });

  doc.saveAndClose();
  moneyTalksShowLinkAlert_(docTitle, copy.getUrl());
}

function moneyTalksDeleteRowByPlaceholder_(body, placeholder) {
  const foundRange = body.findText(placeholder);
  if (!foundRange) {
    return;
  }

  let element = foundRange.getElement();
  while (element && element.getType() !== DocumentApp.ElementType.TABLE_ROW) {
    element = element.getParent();
  }

  if (element && element.getType() === DocumentApp.ElementType.TABLE_ROW) {
    element.removeFromParent();
  }
}

function moneyTalksParseNoteToItems_(note) {
  if (!note) {
    return [];
  }

  return note.split('\n').map(function(line) {
    const parts = line.split(':');
    return {
      key: parts[0] ? parts[0].trim() : '',
      value: parts[1] ? parts[1].trim() : '0'
    };
  }).filter(function(item) {
    return item.key !== '';
  });
}

function moneyTalksFormatNumericalDate_(date) {
  const day = ('0' + date.getDate()).slice(-2);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  return day + '/' + month + '/' + date.getFullYear();
}

function moneyTalksFormatAsCurrency_(value) {
  if (value === '' || value === null || value === undefined) {
    return '$0.00';
  }

  const numericValue = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return isNaN(numericValue) ? '$0.00' : '$' + numericValue.toFixed(2);
}

function moneyTalksShowLinkAlert_(title, url) {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Document Created', '"' + title + '" was successfully created\n\n' + url, ui.ButtonSet.OK);
}

function moneyTalksColumnLetterToIndex_(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}
