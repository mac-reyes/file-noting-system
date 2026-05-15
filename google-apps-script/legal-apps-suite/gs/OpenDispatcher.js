function onOpen(e) {
  callOptionalOnOpen_('onOpen_LegalPortal', typeof onOpen_LegalPortal === 'function' ? onOpen_LegalPortal : null, e);
  callOptionalOnOpen_('onOpen_DocumentGenerator', typeof onOpen_DocumentGenerator === 'function' ? onOpen_DocumentGenerator : null, e);
  callOptionalOnOpen_('onOpen_Analytics', typeof onOpen_Analytics === 'function' ? onOpen_Analytics : null, e);
}

function callOptionalOnOpen_(name, opener, event) {
  if (typeof opener !== 'function') {
    Logger.log('Skipping missing opener: %s', name);
    return;
  }

  try {
    opener(event);
  } catch (error) {
    Logger.log('Opener failed: %s: %s', name, error && error.stack ? error.stack : error);
  }
}

function onOpen_Analytics() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Analytics');
  let hasItems = false;

  if (typeof showClaimStatsModal === 'function') {
    menu.addItem('Open Claim Statistics', 'showClaimStatsModal');
    hasItems = true;
  }

  if (typeof showSettlementCountModal === 'function') {
    menu.addItem('Open Settlement Count', 'showSettlementCountModal');
    hasItems = true;
  }

  if (typeof showClaimStatsDiagnostics === 'function') {
    if (hasItems) {
      menu.addSeparator();
    }
    menu.addItem('Claim Statistics Diagnostics', 'showClaimStatsDiagnostics');
    hasItems = true;
  }

  if (hasItems) {
    menu.addToUi();
  }
}
