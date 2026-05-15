const TASK_MONITOR_CONFIG = {
  timezone: 'Australia/Sydney',
  dueSoonThresholdDays: 7,
  columns: {
    rego: 2,
    priority: 8,
    status: 9,
    nextTaskDue: 10
  },
  headerNames: {
    rego: ['REGO'],
    priority: ['PRIORITY'],
    status: ['STATUS'],
    nextTaskDue: ['NEXT TASK DUE']
  }
};

function getTaskDueItems() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const values = sheet.getDataRange().getValues();
  const items = [];
  const headerContext = buildTaskHeaderContext_(values[0] || []);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const rowValues = values[rowIndex];
    const item = extractTaskItem(rowValues, rowIndex + 1, sheet.getName(), headerContext);
    if (item) {
      items.push(item);
    }
  }

  const sorted = sortTaskItems_(items);
  const lastUpdated = Utilities.formatDate(new Date(), TASK_MONITOR_CONFIG.timezone, 'dd MMM yyyy hh:mm a');

  return { items: sorted, lastUpdated: lastUpdated };
}

function navigateToTaskRow(sheetName, row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (sheet && row >= 1) {
    sheet.getRange(row, 1).activate();
  }
}

function buildTaskHeaderContext_(headerValues) {
  const normalizedHeaderMap = {};
  const headerContext = {};

  (headerValues || []).forEach(function(headerValue, index) {
    const normalizedHeader = normalizeTaskHeader_(headerValue);
    if (normalizedHeader && normalizedHeaderMap[normalizedHeader] === undefined) {
      normalizedHeaderMap[normalizedHeader] = index;
    }
  });

  Object.keys(TASK_MONITOR_CONFIG.headerNames).forEach(function(key) {
    const names = TASK_MONITOR_CONFIG.headerNames[key] || [];
    for (let index = 0; index < names.length; index++) {
      const normalizedName = normalizeTaskHeader_(names[index]);
      if (normalizedHeaderMap[normalizedName] !== undefined) {
        headerContext[key] = normalizedHeaderMap[normalizedName];
        return;
      }
    }
  });

  return headerContext;
}

function normalizeTaskHeader_(value) {
  return asString_(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function getTaskCellValue_(rowValues, key, headerContext) {
  const headerIndex = headerContext && headerContext[key];
  if (typeof headerIndex === 'number' && headerIndex >= 0) {
    return rowValues[headerIndex];
  }

  return rowValues[TASK_MONITOR_CONFIG.columns[key] - 1];
}

function sortTaskItems_(items) {
  return items.slice().sort(function(left, right) {
    const leftRank = getTaskSortRank_(left);
    const rightRank = getTaskSortRank_(right);

    if (leftRank.bucket !== rightRank.bucket) {
      return leftRank.bucket - rightRank.bucket;
    }

    if (leftRank.dateKey !== rightRank.dateKey) {
      return leftRank.dateKey - rightRank.dateKey;
    }

    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function getTaskSortRank_(item) {
  if (!item || !item.dueStatus || !item.dueStatus.dateKey) {
    return { bucket: 4, dateKey: Number.MAX_SAFE_INTEGER };
  }

  const bucketByStatus = { overdue: 0, dueToday: 1, warning: 2, neutral: 3, muted: 4 };

  return {
    bucket: bucketByStatus[item.dueStatus.state] !== undefined ? bucketByStatus[item.dueStatus.state] : 4,
    dateKey: item.dueStatus.dateKey
  };
}
