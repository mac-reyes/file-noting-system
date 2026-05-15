/**
 * Constants and Configuration
 */

const DOCUMENT_TYPES = {
  NOTICE_TO_SUE: 'NOTICE_TO_SUE',
  LETTER_OF_INSTRUCTIONS: 'LETTER_OF_INSTRUCTIONS',
  LETTER_OF_DEMAND_TO_TP_DIRECT: 'LETTER_OF_DEMAND_TO_TP_DIRECT',
  LETTER_OF_DEMAND_TO_INSURANCE: 'LETTER_OF_DEMAND_TO_INSURANCE',
  LETTER_OF_DEMAND_TO_INSURANCE_SUNCORP_AND_BUDGET_DIRECT: 'LETTER_OF_DEMAND_TO_INSURANCE_SUNCORP_AND_BUDGET_DIRECT',
  SOC: 'SOC',
  SOC_VICARIOUS_LIABILITY: 'SOC_VICARIOUS_LIABILITY',
  BULLOCK_SANDERSON_SOC: 'BULLOCK_SANDERSON_SOC',
  DJ: 'DJ',
  EXAMINATION_NOTICE: 'EXAMINATION_NOTICE',
  AOS_EXAMINATION_NOTICE: 'AOS_EXAMINATION_NOTICE',
  WRIT_FOR_PROPERTY: 'WRIT_FOR_PROPERTY'
};

const DOCUMENT_TEMPLATES = {
  [DOCUMENT_TYPES.NOTICE_TO_SUE]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Notice to Sue -'
  },
  [DOCUMENT_TYPES.LETTER_OF_INSTRUCTIONS]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Letters to Instructions -'
  },
  [DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_TP_DIRECT]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Letter of Demand to TP Direct -'
  },
  [DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Letter of Demand to Insurance -'
  },
  [DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE_SUNCORP_AND_BUDGET_DIRECT]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Letter of Demand to Insurance (Suncorp and Budget Direct) -'
  },
  [DOCUMENT_TYPES.SOC]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'SOC -'
  },
  [DOCUMENT_TYPES.SOC_VICARIOUS_LIABILITY]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'SOC - Vicarious Liability -'
  },
  [DOCUMENT_TYPES.BULLOCK_SANDERSON_SOC]: {
    templateId: 'REDACTED_DRIVE_ID`',
    docTitle: 'Bullock Sanderson SOC -'
  },
  [DOCUMENT_TYPES.DJ]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'DJ -'
  },
  [DOCUMENT_TYPES.EXAMINATION_NOTICE]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Examination Notice -'
  },
  [DOCUMENT_TYPES.AOS_EXAMINATION_NOTICE]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'AOS - Examination Notice -'
  },
  [DOCUMENT_TYPES.WRIT_FOR_PROPERTY]: {
    templateId: 'REDACTED_DRIVE_ID',
    docTitle: 'Writ for Property -'
  }
};

const COLUMNS = {
  column_b: 'B',
  column_c: 'C',
  column_d: 'D',
  column_f: 'F',
  column_o: 'O',
  column_p: 'P',
  column_q: 'Q',
  column_r: 'R',
  column_s: 'S'
};

/**
 * UI Helpers
 */

function onOpen_DocumentGenerator() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Document Generator');

  const subMenu = ui
    .createMenu('Generate document for the selected row')
    .addItem('Letter of Instructions', 'generateLetterOfInstructions')
    .addItem('Notice to Sue', 'generateNoticeToSue')
    .addItem('Letter of Demand to TP Direct', 'generateLetterOfDemandToTPDirect')
    .addItem('Letter of Demand to Insurance', 'generateLetterOfDemandToInsurance')
    .addItem('Letter of Demand to Insurance (Suncorp and Budget Direct)', 'generateLetterOfDemandToInsuranceSuncorpAndBudgetDirect')
    .addItem('SOC', 'generateSOC')
    .addItem('SOC - Vicarious Liability', 'generateSOCVicariousLiability')
    .addItem('Bullock Sanderson - SOC', 'generateBullockSandersonSOC')
    .addItem('DJ', 'generateDJ')
    .addItem('AOS - Examination Notice', 'generateAOSExaminationNotice')
    .addItem('Examination Notice', 'generateExaminationNotice')
    .addItem('Writ for Property', 'generateWritForProperty');

  menu.addSubMenu(subMenu).addToUi();
}

function showSuccessAlert(title, url) {
  const ui = SpreadsheetApp.getUi();
  ui.alert(`"${title}" was successfully created`, `${url}\n\nYou can now access it using the link above.`, ui.ButtonSet.OK);
}

/**
 * Entry Points (Linked to Menu)
 */

function generateNoticeToSue() {
  generateDocument(DOCUMENT_TYPES.NOTICE_TO_SUE);
}

function generateLetterOfInstructions() {
  generateDocument(DOCUMENT_TYPES.LETTER_OF_INSTRUCTIONS);
}

function generateLetterOfDemandToTPDirect() {
  generateDocument(DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_TP_DIRECT);
}

function generateLetterOfDemandToInsurance() {
  generateDocument(DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE);
}

function generateLetterOfDemandToInsuranceSuncorpAndBudgetDirect() {
  generateDocument(DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE_SUNCORP_AND_BUDGET_DIRECT);
}

function generateSOC() {
  generateDocument(DOCUMENT_TYPES.SOC);
}

function generateSOCVicariousLiability() {
  generateDocument(DOCUMENT_TYPES.SOC_VICARIOUS_LIABILITY);
}

function generateBullockSandersonSOC() {
  generateDocument(DOCUMENT_TYPES.BULLOCK_SANDERSON_SOC);
}

function generateDJ() {
  generateDocument(DOCUMENT_TYPES.DJ);
}

function generateExaminationNotice() {
  generateDocument(DOCUMENT_TYPES.EXAMINATION_NOTICE);
}

function generateAOSExaminationNotice() {
  generateDocument(DOCUMENT_TYPES.AOS_EXAMINATION_NOTICE);
}

function generateWritForProperty() {
  generateDocument(DOCUMENT_TYPES.WRIT_FOR_PROPERTY);
}

/**
 * Main Document Generator
 */

function generateDocument(docType) {
  const config = DOCUMENT_TEMPLATES[docType];
  if (!config) {
    throw new Error(`Unknown document type: ${docType}`);
  }

  const { templateId, docTitle } = config;
  const rowData = getSelectedRowData();
  if (!rowData) return;

  const data = {};
  for (const [key, letter] of Object.entries(COLUMNS)) {
    const idx = columnLetterToIndex(letter);
    data[key] = rowData[idx];
  }

  const copy = DriveApp.getFileById(templateId).makeCopy(`${docTitle} ${data.column_b}`);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  const { column_b, column_c, column_d, column_f, column_o, column_p, column_q, column_r, column_s } = data;
  body.replaceText('{{column_b}}', column_b);
  body.replaceText('{{column_c}}', column_c);
  body.replaceText('{{column_d}}', column_d);
  body.replaceText('{{column_f}}', column_f);
  body.replaceText('{{column_o}}', column_o);
  body.replaceText('{{column_p}}', formatDate(column_p, docType));
  body.replaceText('{{column_q}}', column_q);
  body.replaceText('{{column_r}}', column_r);
  body.replaceText('{{column_s}}', column_s);

  doc.saveAndClose();

  showSuccessAlert(`${docTitle} ${column_b}`, copy.getUrl());
}

/**
 * Row Selection & Validation
 */

function getSelectedRowData() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();

  if (range.getNumRows() !== 1) {
    ui.alert('Please select exactly one row.');
    return null;
  }

  const row = range.getRow();
  const numCols = sheet.getLastColumn();
  const rowData = sheet.getRange(row, 1, 1, numCols).getValues()[0];

  return rowData;
}

/**
 * Utility Functions
 */

function getOrdinalSuffix(day) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = day % 100;
  return day + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

function formatDate(dateString, docType) {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  switch (docType) {
    case DOCUMENT_TYPES.NOTICE_TO_SUE:
    case DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_TP_DIRECT:
    case DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE:
    case DOCUMENT_TYPES.LETTER_OF_DEMAND_TO_INSURANCE_SUNCORP_AND_BUDGET_DIRECT:
    case DOCUMENT_TYPES.SOC:
    case DOCUMENT_TYPES.SOC_VICARIOUS_LIABILITY:
    case DOCUMENT_TYPES.BULLOCK_SANDERSON_SOC:
      return `${getOrdinalSuffix(day)} of ${month} ${year}`;
    case DOCUMENT_TYPES.LETTER_OF_INSTRUCTIONS:
    default:
      return `${day} ${month} ${year}`;
  }
}

function columnLetterToIndex(letter) {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index *= 26;
    index += letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
  }
  return index - 1;
}
