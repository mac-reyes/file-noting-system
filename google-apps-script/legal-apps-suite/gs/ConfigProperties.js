/**
 * Runtime access to ID configuration stored in Script Properties.
 *
 * IDs are not committed to source. They live in the untracked
 * config.ids.local.json, are embedded into a feature-scoped dist/Setup.gs at
 * build time, and are written into Script Properties by running
 * setupLegalAppsSuiteScriptProperties() once per Apps Script project.
 */

var CONFIG_PROPERTIES_CACHE_ = {};

function getScriptProperty_(key) {
  if (Object.prototype.hasOwnProperty.call(CONFIG_PROPERTIES_CACHE_, key)) {
    return CONFIG_PROPERTIES_CACHE_[key];
  }

  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (value === null || value === '') {
    throw new Error(
      'Missing Script Property "' + key + '". Run setupLegalAppsSuiteScriptProperties() ' +
      'once in this Apps Script project to populate ID configuration.'
    );
  }

  CONFIG_PROPERTIES_CACHE_[key] = value;
  return value;
}

function getJsonScriptProperty_(key) {
  var cacheKey = key + '::parsed';
  if (Object.prototype.hasOwnProperty.call(CONFIG_PROPERTIES_CACHE_, cacheKey)) {
    return CONFIG_PROPERTIES_CACHE_[cacheKey];
  }

  var parsed = JSON.parse(getScriptProperty_(key));
  CONFIG_PROPERTIES_CACHE_[cacheKey] = parsed;
  return parsed;
}

function getRecoveryDocumentTemplates_() {
  return getJsonScriptProperty_('RECOVERY_DOCUMENT_TEMPLATES');
}

function getRepairerMap_() {
  return getJsonScriptProperty_('REPAIRER_MAP');
}

function getMoneyTalksSettlementReleaseTemplateId_() {
  return getScriptProperty_('MONEY_TALKS_SETTLEMENT_RELEASE_TEMPLATE_ID');
}
