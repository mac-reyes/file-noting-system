const SETTLEMENT_COUNT_CONFIG = {
  timezone: 'Australia/Sydney',
  settlementDateColumn: 2,
  firstDataRow: 2
};

function showSettlementCountModal() {
  try {
    const report = getSettlementCountReport('custom', '', '');
    const template = HtmlService.createTemplateFromFile('SettlementCountModal');
    template.report = report;

    const html = template.evaluate().setWidth(620).setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(html, 'Settlement Count');
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      'Settlement Count Error',
      error && error.message ? error.message : String(error),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function getSettlementCountReport(preset, fromDateKey, toDateKey) {
  return buildSettlementCountReport_(preset || 'custom', new Date(), fromDateKey || '', toDateKey || '');
}

function buildSettlementCountReport_(preset, now, fromDateKey, toDateKey) {
  const dateKeys = buildSettlementCountDateKeys_(now || new Date());
  const rangeDefaults = buildSettlementCountRangeDefaults_(now || new Date());
  const rangeConfig = getSettlementCountRangeConfig_(preset, fromDateKey, toDateKey, rangeDefaults);
  const totalSettlements = countSettlementsInRange_(rangeConfig);

  return {
    title: 'Settlement Count - ' + rangeConfig.label,
    badge: 'Settlement Count',
    subtitle: rangeConfig.rangeLabel + ' - ' + SETTLEMENT_COUNT_CONFIG.timezone,
    preset: rangeConfig.preset,
    fromDateKey: rangeConfig.fromDateKey,
    toDateKey: rangeConfig.toDateKey,
    rangeDefaults: rangeDefaults,
    rangeLabel: rangeConfig.rangeLabel,
    lastScanned: dateKeys.loggedAtDisplay,
    totalSettlements: totalSettlements
  };
}

function countSettlementsInRange_(rangeConfig) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const firstDataRow = SETTLEMENT_COUNT_CONFIG.firstDataRow;

  if (lastRow < firstDataRow) {
    return 0;
  }

  const values = sheet
    .getRange(
      firstDataRow,
      SETTLEMENT_COUNT_CONFIG.settlementDateColumn,
      lastRow - firstDataRow + 1,
      1
    )
    .getValues();

  return values.reduce(function(count, rowValues) {
    const dateKey = normalizeSettlementDateKey_(rowValues[0]);
    if (!dateKey) {
      return count;
    }

    if (rangeConfig.isAll || (dateKey >= rangeConfig.fromDateKey && dateKey <= rangeConfig.toDateKey)) {
      return count + 1;
    }

    return count;
  }, 0);
}

function getSettlementCountRangeConfig_(preset, fromDateKey, toDateKey, rangeDefaults) {
  const normalizedPreset = normalizeSettlementCountPreset_(preset);

  if (normalizedPreset === 'all') {
    return {
      preset: 'all',
      label: 'All Settlements',
      fromDateKey: '',
      toDateKey: '',
      isAll: true,
      rangeLabel: 'All valid settlement dates'
    };
  }

  const defaultRange = rangeDefaults[normalizedPreset] || rangeDefaults.custom;
  const normalizedFrom = settlementCountString_(fromDateKey).trim() || defaultRange.fromDateKey;
  const normalizedTo = settlementCountString_(toDateKey).trim() || defaultRange.toDateKey;
  validateSettlementCountDateRange_(normalizedFrom, normalizedTo);

  return {
    preset: normalizedPreset,
    label: getSettlementCountPresetLabel_(normalizedPreset),
    fromDateKey: normalizedFrom,
    toDateKey: normalizedTo,
    isAll: false,
    rangeLabel: normalizedFrom === normalizedTo
      ? normalizedFrom
      : normalizedFrom + ' to ' + normalizedTo
  };
}

function normalizeSettlementCountPreset_(preset) {
  const normalizedPreset = settlementCountString_(preset).trim().toLowerCase();
  const aliases = {
    today: 'today',
    day: 'today',
    this_week: 'this_week',
    week: 'this_week',
    this_month: 'this_month',
    month: 'this_month',
    this_year: 'this_year',
    year: 'this_year',
    custom: 'custom',
    all: 'all'
  };

  if (!normalizedPreset) {
    return 'custom';
  }

  if (!aliases[normalizedPreset]) {
    throw new Error('Unsupported settlement count preset "' + preset + '".');
  }

  return aliases[normalizedPreset];
}

function getSettlementCountPresetLabel_(preset) {
  const labels = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
    custom: 'Custom Range',
    all: 'All Settlements'
  };

  return labels[preset] || labels.custom;
}

function validateSettlementCountDateRange_(fromDateKey, toDateKey) {
  validateSettlementCountDateKey_(fromDateKey, 'From date');
  validateSettlementCountDateKey_(toDateKey, 'To date');

  if (fromDateKey > toDateKey) {
    throw new Error('From date must be before or equal to To date.');
  }
}

function validateSettlementCountDateKey_(dateKey, label) {
  if (!dateKey) {
    throw new Error(label + ' is required.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(label + ' must use yyyy-MM-dd format.');
  }

  if (!parseSettlementDateKey_(dateKey)) {
    throw new Error(label + ' is not a valid calendar date.');
  }
}

function normalizeSettlementDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd');
  }

  const rawValue = settlementCountString_(value).trim();
  if (!rawValue) {
    return '';
  }

  const isoDate = parseSettlementDateKey_(rawValue);
  if (isoDate) {
    return Utilities.formatDate(isoDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd');
  }

  const slashDate = parseSettlementSlashDate_(rawValue);
  if (slashDate) {
    return Utilities.formatDate(slashDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd');
  }

  const monthNameDate = parseSettlementMonthNameDate_(rawValue);
  if (monthNameDate) {
    return Utilities.formatDate(monthNameDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd');
  }

  return '';
}

function parseSettlementDateKey_(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(settlementCountString_(dateKey).trim());
  if (!match) {
    return null;
  }

  return buildSettlementDate_(Number(match[1]), Number(match[2]), Number(match[3]));
}

function parseSettlementSlashDate_(value) {
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(value);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }

  return buildSettlementDate_(year, month, day);
}

function parseSettlementMonthNameDate_(value) {
  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };
  const normalizedValue = value.replace(/,/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  let match = /^(\d{1,2}) ([A-Za-z]+) (\d{2}|\d{4})$/.exec(normalizedValue);

  if (match) {
    return buildSettlementDateFromMonthName_(Number(match[1]), match[2], Number(match[3]), months);
  }

  match = /^([A-Za-z]+) (\d{1,2}) (\d{2}|\d{4})$/.exec(normalizedValue);
  if (match) {
    return buildSettlementDateFromMonthName_(Number(match[2]), match[1], Number(match[3]), months);
  }

  return null;
}

function buildSettlementDateFromMonthName_(day, monthName, year, months) {
  const month = months[settlementCountString_(monthName).toLowerCase()];
  if (!month) {
    return null;
  }

  if (year < 100) {
    year += 2000;
  }

  return buildSettlementDate_(year, month, day);
}

function buildSettlementDate_(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function buildSettlementCountDateKeys_(date) {
  const timezone = SETTLEMENT_COUNT_CONFIG.timezone;
  const dateKey = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
  const yearMonth = Utilities.formatDate(date, timezone, 'yyyy-MM');
  const dayOfWeek = Number(Utilities.formatDate(date, timezone, 'u'));
  const monday = new Date(date.getTime() - ((dayOfWeek + 6) % 7) * 24 * 60 * 60 * 1000);

  return {
    loggedAtDisplay: Utilities.formatDate(date, timezone, 'yyyy-MM-dd HH:mm:ss'),
    dateKey: dateKey,
    weekKey: Utilities.formatDate(monday, timezone, 'yyyy-MM-dd'),
    monthKey: yearMonth
  };
}

function buildSettlementCountRangeDefaults_(date) {
  const dateKeys = buildSettlementCountDateKeys_(date || new Date());
  const weekStartDate = parseSettlementDateKey_(dateKeys.weekKey);
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
      toDateKey: Utilities.formatDate(weekEndDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd')
    },
    this_month: {
      fromDateKey: Utilities.formatDate(monthStartDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd'),
      toDateKey: Utilities.formatDate(monthEndDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd')
    },
    this_year: {
      fromDateKey: Utilities.formatDate(yearStartDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd'),
      toDateKey: Utilities.formatDate(yearEndDate, SETTLEMENT_COUNT_CONFIG.timezone, 'yyyy-MM-dd')
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

function settlementCountString_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}
