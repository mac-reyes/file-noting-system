/**
 * Money Talks invoice document generator.
 */

// Template IDs come from Script Properties (see ConfigProperties.js /
// getMoneyTalksInvoiceTemplates_), keyed by template name (EPP /
// EPP_PAYABLE_TO_ISP / ISP).
//
// Template is chosen by which menu item the user clicks (see OpenDispatcher.js
// and generateMoneyTalksInvoiceEpp/EppPayableToIsp/Isp below), not by the
// "ISP OR EPP" column on the sheet - the client asked to move template
// selection to the menu instead of relying on that dropdown (that column
// stays on the sheet for their own tracking, it's just no longer read here).

// Column layout matches the live INVOICING tab exactly (confirmed with the
// user), not the letters originally guessed from the template placeholders.
const MONEY_TALKS_INVOICE_COLUMNS = {
  column_b: 'B', // INV #
  column_c: 'C', // Reference
  column_d: 'D', // Bill to - name
  column_e: 'E', // Address
  column_f: 'F', // ABN (if applicable) - hidden if blank
  column_g: 'G', // Issue date
  column_h: 'H', // Due date
  column_i: 'I', // Item + Description - note holds the item breakdown
  column_j: 'J', // Total price (subtotal)
  column_k: 'K', // GST % - drives the GST notice; not shown directly in the doc
  column_l: 'L', // GST amount
  column_m: 'M' // Amount due
};

function generateMoneyTalksInvoiceEpp() {
  generateMoneyTalksInvoice_('EPP');
}

function generateMoneyTalksInvoiceEppPayableToIsp() {
  generateMoneyTalksInvoice_('EPP_PAYABLE_TO_ISP');
}

function generateMoneyTalksInvoiceIsp() {
  generateMoneyTalksInvoice_('ISP');
}

function generateMoneyTalksInvoice_(templateKey) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = moneyTalksInvoiceGetSheetByName_(spreadsheet, 'INVOICING');
  const activeSheet = spreadsheet.getActiveSheet();

  if (activeSheet.getSheetId() !== sheet.getSheetId()) {
    SpreadsheetApp.getUi().alert('Please select a row on the Invoicing tab.');
    return;
  }

  const range = sheet.getActiveRange();
  if (range.getNumRows() !== 1) {
    SpreadsheetApp.getUi().alert('Please select exactly one row.');
    return;
  }

  const row = range.getRow();
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columns = MONEY_TALKS_INVOICE_COLUMNS;

  const templateId = moneyTalksInvoiceGetTemplateId_(templateKey);

  const invoiceNumber = rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_b)];
  const clientName = rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_d)];
  const docTitle = 'Invoice INV-' + invoiceNumber + ' - ' + clientName;

  const copy = DriveApp.getFileById(templateId).makeCopy(docTitle);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  moneyTalksInvoiceReplaceOrHide_(body, '{{column_f}}', rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_f)]);

  const noteContent = sheet.getRange(row, moneyTalksInvoiceColumnLetterToIndex_(columns.column_i) + 1).getNote();
  const breakdownItems = moneyTalksInvoiceParseNoteToItems_(noteContent);

  ['a', 'b', 'c', 'd', 'e'].forEach(function(suffix, index) {
    const namePlaceholder = '{{item_name_' + suffix + '}}';
    const descriptionPlaceholder = '{{item_description_' + suffix + '}}';
    const valuePlaceholder = '{{item_value_' + suffix + '}}';

    if (index < breakdownItems.length) {
      const splitKey = moneyTalksInvoiceSplitItemKey_(breakdownItems[index].key);
      body.replaceText(namePlaceholder, splitKey.name);
      body.replaceText(descriptionPlaceholder, splitKey.description);
      // Reused for both the Unit Price and Amount cells - no separate
      // quantity/unit-price data exists, so both show the same total.
      body.replaceText(valuePlaceholder, moneyTalksInvoiceFormatAsCurrency_(breakdownItems[index].value));
    } else {
      moneyTalksInvoiceDeleteRowByPlaceholder_(body, namePlaceholder);
    }
  });

  const standardMappings = {
    '{{column_b}}': rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_b)],
    '{{column_c}}': rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_c)],
    '{{column_d}}': rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_d)],
    '{{column_e}}': rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_e)],
    '{{column_g}}': moneyTalksInvoiceFormatDate_(rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_g)]),
    '{{column_h}}': moneyTalksInvoiceFormatDate_(rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_h)]),
    '{{column_j}}': moneyTalksInvoiceFormatAsCurrency_(rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_j)]),
    '{{column_l}}': moneyTalksInvoiceFormatAsCurrency_(rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_l)]),
    '{{column_m}}': moneyTalksInvoiceFormatAsCurrency_(rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_m)])
  };

  Object.keys(standardMappings).forEach(function(placeholder) {
    body.replaceText(placeholder, standardMappings[placeholder] || '');
  });

  const gstPercent = rowData[moneyTalksInvoiceColumnLetterToIndex_(columns.column_k)];
  moneyTalksInvoiceReplaceGstNotice_(body, moneyTalksInvoiceIsBlank_(gstPercent));

  doc.saveAndClose();
  moneyTalksInvoiceShowLinkAlert_(docTitle, copy.getUrl());
}

function moneyTalksInvoiceGetSheetByName_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" was not found.');
  }

  return sheet;
}

function moneyTalksInvoiceGetTemplateId_(templateKey) {
  const templates = getMoneyTalksInvoiceTemplates_();
  const templateId = templates[templateKey];
  if (!templateId) {
    throw new Error('No invoice template configured for "' + templateKey + '".');
  }

  return templateId;
}

function moneyTalksInvoiceIsBlank_(value) {
  return value === '' || value === null || value === undefined;
}

function moneyTalksInvoiceReplaceOrHide_(body, placeholder, value) {
  if (moneyTalksInvoiceIsBlank_(value)) {
    moneyTalksInvoiceDeleteParagraphByPlaceholder_(body, placeholder);
    return;
  }

  body.replaceText(placeholder, String(value));
}

function moneyTalksInvoiceReplaceGstNotice_(body, isGstFree) {
  const foundRange = body.findText('{{gst_notice}}');
  if (!foundRange) {
    return;
  }

  const textElement = foundRange.getElement().asText();
  const startOffset = foundRange.getStartOffset();
  const endOffsetInclusive = foundRange.getEndOffsetInclusive();

  textElement.deleteText(startOffset, endOffsetInclusive);

  const prefix = 'Total is GST';
  const suffix = isGstFree ? '-free' : '-inclusive';
  textElement.insertText(startOffset, prefix + suffix + '.');

  const suffixStart = startOffset + prefix.length;
  const suffixEnd = suffixStart + suffix.length - 1;
  textElement.setItalic(suffixStart, suffixEnd, true);
}

function moneyTalksInvoiceParseNoteToItems_(note) {
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

function moneyTalksInvoiceSplitItemKey_(key) {
  const separatorIndex = key.indexOf(' - ');
  if (separatorIndex === -1) {
    return { name: key, description: '' };
  }

  return {
    name: key.substring(0, separatorIndex).trim(),
    description: key.substring(separatorIndex + 3).trim()
  };
}

function moneyTalksInvoiceDeleteRowByPlaceholder_(body, placeholder) {
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

function moneyTalksInvoiceDeleteParagraphByPlaceholder_(body, placeholder) {
  const foundRange = body.findText(placeholder);
  if (!foundRange) {
    return;
  }

  let element = foundRange.getElement();
  while (element && element.getType() !== DocumentApp.ElementType.PARAGRAPH) {
    element = element.getParent();
  }

  if (element && element.getType() === DocumentApp.ElementType.PARAGRAPH) {
    element.removeFromParent();
  }
}

function moneyTalksInvoiceFormatDate_(value) {
  if (!(value instanceof Date)) {
    return value || '';
  }

  const day = ('0' + value.getDate()).slice(-2);
  const month = ('0' + (value.getMonth() + 1)).slice(-2);
  return day + '/' + month + '/' + value.getFullYear();
}

function moneyTalksInvoiceFormatAsCurrency_(value) {
  if (value === '' || value === null || value === undefined) {
    return '$0.00';
  }

  const numericValue = parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return isNaN(numericValue) ? '$0.00' : '$' + numericValue.toFixed(2);
}

function moneyTalksInvoiceShowLinkAlert_(title, url) {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Document Created', '"' + title + '" was successfully created\n\n' + url, ui.ButtonSet.OK);
}

function moneyTalksInvoiceColumnLetterToIndex_(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1;
}
