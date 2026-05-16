function extractTaskItem(rowValues, rowNumber, sheetName, headerContext) {
  const rego = asString_(getTaskCellValue_(rowValues, 'rego', headerContext)).trim();

  if (!rego) {
    return null;
  }

  const nextTaskDue = getTaskCellValue_(rowValues, 'nextTaskDue', headerContext);
  const priority = asString_(getTaskCellValue_(rowValues, 'priority', headerContext)).trim();
  const status = asString_(getTaskCellValue_(rowValues, 'status', headerContext)).trim();
  const dueStatus = buildTaskDueStatus_(nextTaskDue);

  return {
    row: rowNumber,
    sheetName: sheetName,
    type: 'task',
    title: rego,
    priority: priority || 'Unknown',
    status: status || 'Unknown',
    dueStatus: dueStatus,
    taskKey: {
      row: rowNumber,
      sheetName: sheetName
    }
  };
}

function buildTaskDueStatus_(value) {
  const dueDate = parseSheetDateTime_(value) || parseSheetDateOnly_(value);

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
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const daysUntil = Math.round((dueDateOnly.getTime() - today.getTime()) / 86400000);

  let state = 'neutral';
  let label = 'Due ' + formatDateOnly_(dueDateOnly);

  if (daysUntil < 0) {
    state = 'overdue';
    label = 'Overdue by ' + Math.abs(daysUntil) + ' day' + (Math.abs(daysUntil) === 1 ? '' : 's');
  } else if (daysUntil === 0) {
    state = 'dueToday';
    label = 'Due today';
  } else if (daysUntil <= TASK_MONITOR_CONFIG.dueSoonThresholdDays) {
    state = 'warning';
    label = 'Due in ' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's');
  }

  return {
    state: state,
    label: label,
    dateText: formatDateOnly_(dueDateOnly),
    daysUntil: daysUntil,
    dateKey: Number(Utilities.formatDate(dueDateOnly, TASK_MONITOR_CONFIG.timezone, 'yyyyMMdd'))
  };
}
