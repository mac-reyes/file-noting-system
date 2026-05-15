function createAndMapRepairerFiles() {
  const rawList = [
    "New Prototype", "MF Auto", "Hapos Autobody", "Cleveland Prestige", "All Insurance Smash Repairs", 
    "2K Auto", "Ming", "GMR", "Franklin Smash Repairs", "Bailey Smash Repairs", 
    "Five Dock Smash Repairs", "Prestige Autobody", "SVH Collision", "Stewart & Armstrong", "Bob Powertech", 
    "Graham Hill Smash Repairs", "Aus Global", "Private Repairer", "T&L Bodyworks", "Global Smash Repairs", 
    "South West Collision Repairs", "BH Smash Repairs", "Private Client", "888 Smash Repairs", "Pristine Motor Repairs", 
    "Paramount Recoveries", "Aus Global (Stanley)", "Aus Global (Ronald)", "Moey Halloum", "AAA Body & Paint", 
    "United Auto", "Delta", "Euro Auto Body", "Horizon", "JL Auto", "Alliance Auto Body", 
    "Smeaton Grange Rental", "Chammaz Bodyworks", "My Car Claims", "X5 Prestige Vehicle Repairs", "AKR Mechanical", 
    "Ben Prestige Auto Body Rental", "ATA Smash Repairs", "SG Automotive", "Platinum Prestige", "Superb Smash Repairs", 
    "Newcastle Carmotive", "Gartmore Smash Repairs", "Pristine Co", "Simplicity Smash Repairs", "Buzz Hire Car", 
    "Baz Smash Repairs", "Silverwater Collision Centre", "All Autosmash Repairs", "Max Auto", "Sydney Luxury Car Rental", 
    "Michael Chang", "Best Smash Repairs", "Long Auto Repairs", "Dong", "SMY Smash Repairs", 
    "Prestige Ride Share Club", "Rime Car Repairs", "Archers Smash Repairs", "Rideshare Club", "Omni Rideshare", 
    "Bayside Car Rentals", "Motor Claims Management Services", "Romi Recoveries", "Good to Go Car Rental", "Isabella Smash Repairs", 
    "T-One Autohouse", "Rydlemeve Prestige", "Seven Star Service", "Knight Auto", "Rosedale AutoBody", 
    "Micheal Chang", "Randr Fleet", "Zerow Group Services", "United Smash", "P&J Group", 
    "Platinum Prestige Smash Repairs", "X-Five Smash Repairs", "Sydney Luxury Car Rentals", "Sydney European Auto Body Repairs", "Drive Car Group", 
    "North Prestige Auto Services", "Simplicity Smash Repair", "Best Deal Group", "All Autosmash Pty Ltd", "Archers Mechanical & Smash Repairs", 
    "Times Automotive", "Tone Autohouse", "Tec Smash Repairs", "Forest Road Smash Repairs"
  ];

  // Logic for Exclusions
  const toExclude = [
    "888 Smash Repairs", "Moey Halloum", "My Car Claims", "T-One Autohouse", 
    "Motor Claims Management Services", "Long Auto Repairs", "Best Smash Repairs", 
    "Baz Smash Repairs", "Ben Prestige Auto Body Rental", "Prestige Autobody", "GMR"
  ];

  // Logic for Groupings (Maps many names to one file name)
  const groups = {
    "New Prototype": "New Prototype_Cleveland Prestige",
    "Cleveland Prestige": "New Prototype_Cleveland Prestige",
    "Graham Hill Smash Repairs": "Graham Hill_Southwest_Smeaton",
    "South West Collision Repairs": "Graham Hill_Southwest_Smeaton",
    "Smeaton Grange Rental": "Graham Hill_Southwest_Smeaton",
    "Aus Global": "Aus Global_AKR Group",
    "Aus Global (Stanley)": "Aus Global_AKR Group",
    "Aus Global (Ronald)": "Aus Global_AKR Group",
    "AKR Mechanical": "Aus Global_AKR Group",
    "Hapos Autobody": "Hapos_Euro Auto Body",
    "Euro Auto Body": "Hapos_Euro Auto Body",
    "2K Auto": "2K Auto_Good to Go",
    "Good to Go Car Rental": "2K Auto_Good to Go"
  };

  const folder = DriveApp.createFolder("Consolidated Repairer Files");
  const finalMap = {};
  const createdGroupFiles = {};

  rawList.forEach(name => {
    const trimmedName = name.trim();

    // Condition: Exclude specific entries
    if (toExclude.includes(trimmedName)) return;

    // Condition: Check for Grouping
    let targetFileName = groups[trimmedName] || trimmedName;

    // Condition: Don't create the file if it already exists (for groups)
    if (!createdGroupFiles[targetFileName]) {
      // Change to DocumentApp.create(targetFileName) if you want Docs
      const newFile = SpreadsheetApp.create(targetFileName); 
      const fileId = newFile.getId();
      
      // Move the new file to the folder
      DriveApp.getFileById(fileId).moveTo(folder);
      
      createdGroupFiles[targetFileName] = fileId;
    }

    // Add to our final mapping
    finalMap[trimmedName] = createdGroupFiles[targetFileName];
  });

  // Log the final result
  Logger.log("--- START FINAL MAPPING ---");
  Logger.log(JSON.stringify(finalMap, null, 2));
  Logger.log("--- END FINAL MAPPING ---");
  Logger.log("Folder Link: " + folder.getUrl());
}

/**
 * @OnlyCurrentDoc
 */

function syncByRepairer(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- CONFIGURATION: TARGET FIRST 8 TABS ---
  const ALLOWED_INDICES = [0, 1, 2, 3, 4, 5, 6]; 
  // ------------------------------------------

  // 1. REPAIRER MAP
  const REPAIRER_MAP = {
    "New Prototype": "REDACTED_DRIVE_ID",
    "MF Auto": "REDACTED_DRIVE_ID",
    "Hapos Autobody": "REDACTED_DRIVE_ID",
    "Cleveland Prestige": "REDACTED_DRIVE_ID",
    "All Insurance Smash Repairs": "REDACTED_DRIVE_ID",
    "2K Auto": "REDACTED_DRIVE_ID",
    "Ming": "REDACTED_DRIVE_ID",
    "Franklin Smash Repairs": "REDACTED_DRIVE_ID",
    "Bailey Smash Repairs": "REDACTED_DRIVE_ID",
    "Five Dock Smash Repairs": "REDACTED_DRIVE_ID",
    "SVH Collision": "REDACTED_DRIVE_ID",
    "Stewart & Armstrong": "REDACTED_DRIVE_ID",
    "Bob Powertech": "REDACTED_DRIVE_ID",
    "Graham Hill Smash Repairs": "REDACTED_DRIVE_ID",
    "Aus Global": "REDACTED_DRIVE_ID",
    "Private Repairer": "REDACTED_DRIVE_ID",
    "T&L Bodyworks": "REDACTED_DRIVE_ID",
    "Global Smash Repairs": "REDACTED_DRIVE_ID",
    "South West Collision Repairs": "REDACTED_DRIVE_ID",
    "BH Smash Repairs": "REDACTED_DRIVE_ID",
    "Private Client": "REDACTED_DRIVE_ID",
    "Pristine Motor Repairs": "REDACTED_DRIVE_ID",
    "Paramount Recoveries": "REDACTED_DRIVE_ID",
    "Aus Global (Stanley)": "REDACTED_DRIVE_ID",
    "Aus Global (Ronald)": "REDACTED_DRIVE_ID",
    "AAA Body & Paint": "REDACTED_DRIVE_ID",
    "United Auto": "REDACTED_DRIVE_ID",
    "Delta": "REDACTED_DRIVE_ID",
    "Euro Auto Body": "REDACTED_DRIVE_ID",
    "Horizon": "REDACTED_DRIVE_ID",
    "JL Auto": "REDACTED_DRIVE_ID",
    "Alliance Auto Body": "REDACTED_DRIVE_ID",
    "Smeaton Grange Rental": "REDACTED_DRIVE_ID",
    "Chammaz Bodyworks": "REDACTED_DRIVE_ID",
    "X5 Prestige Vehicle Repairs": "REDACTED_DRIVE_ID",
    "AKR Mechanical": "REDACTED_DRIVE_ID",
    "ATA Smash Repairs": "REDACTED_DRIVE_ID",
    "SG Automotive": "REDACTED_DRIVE_ID",
    "Platinum Prestige": "REDACTED_DRIVE_ID",
    "Superb Smash Repairs": "REDACTED_DRIVE_ID",
    "Newcastle Carmotive": "REDACTED_DRIVE_ID",
    "Gartmore Smash Repairs": "REDACTED_DRIVE_ID",
    "Pristine Co": "REDACTED_DRIVE_ID",
    "Simplicity Smash Repairs": "REDACTED_DRIVE_ID",
    "Buzz Hire Car": "REDACTED_DRIVE_ID",
    "Silverwater Collision Centre": "REDACTED_DRIVE_ID",
    "All Autosmash Repairs": "REDACTED_DRIVE_ID",
    "Max Auto": "REDACTED_DRIVE_ID",
    "Sydney Luxury Car Rental": "REDACTED_DRIVE_ID",
    "Michael Chang": "REDACTED_DRIVE_ID",
    "Dong": "REDACTED_DRIVE_ID",
    "SMY Smash Repairs": "REDACTED_DRIVE_ID",
    "Prestige Ride Share Club": "REDACTED_DRIVE_ID",
    "Rime Car Repairs": "REDACTED_DRIVE_ID",
    "Archers Smash Repairs": "REDACTED_DRIVE_ID",
    "Rideshare Club": "REDACTED_DRIVE_ID",
    "Omni Rideshare": "REDACTED_DRIVE_ID",
    "Bayside Car Rentals": "REDACTED_DRIVE_ID",
    "Romi Recoveries": "REDACTED_DRIVE_ID",
    "Good to Go Car Rental": "REDACTED_DRIVE_ID",
    "Isabella Smash Repairs": "REDACTED_DRIVE_ID",
    "Rydlemeve Prestige": "REDACTED_DRIVE_ID",
    "Seven Star Service": "REDACTED_DRIVE_ID",
    "Knight Auto": "REDACTED_DRIVE_ID",
    "Rosedale AutoBody": "REDACTED_DRIVE_ID",
    "Micheal Chang": "REDACTED_DRIVE_ID",
    "Randr Fleet": "REDACTED_DRIVE_ID",
    "Zerow Group Services": "REDACTED_DRIVE_ID",
    "United Smash": "REDACTED_DRIVE_ID",
    "P&J Group": "REDACTED_DRIVE_ID",
    "Platinum Prestige Smash Repairs": "REDACTED_DRIVE_ID",
    "X-Five Smash Repairs": "REDACTED_DRIVE_ID",
    "Sydney Luxury Car Rentals": "REDACTED_DRIVE_ID",
    "Sydney European Auto Body Repairs": "REDACTED_DRIVE_ID",
    "Drive Car Group": "REDACTED_DRIVE_ID",
    "North Prestige Auto Services": "REDACTED_DRIVE_ID",
    "Simplicity Smash Repair": "REDACTED_DRIVE_ID",
    "Best Deal Group": "REDACTED_DRIVE_ID",
    "All Autosmash Pty Ltd": "REDACTED_DRIVE_ID",
    "Archers Mechanical & Smash Repairs": "REDACTED_DRIVE_ID",
    "Times Automotive": "REDACTED_DRIVE_ID",
    "Tone Autohouse": "REDACTED_DRIVE_ID",
    "Tec Smash Repairs": "REDACTED_DRIVE_ID",
    "Forest Road Smash Repairs": "REDACTED_DRIVE_ID"
  };

  // 2. TRIGGER & TAB VALIDATION
  const allSheets = ss.getSheets();
  const editedSheet = e.source.getActiveSheet();
  
  // Find the position (index) of the sheet currently being edited
  const editedIndex = allSheets.findIndex(s => s.getName() === editedSheet.getName());

  // STOP if the edit happened outside the first 5 tabs
  if (!ALLOWED_INDICES.includes(editedIndex)) {
    console.log("Edit ignored: Sheet index " + editedIndex + " is not in the allowed range.");
    return;
  }

  const editedRow = e.range.getRow();
  const repairerName = editedSheet.getRange(editedRow, 1).getValue().toString().trim();

  if (!REPAIRER_MAP[repairerName]) return;

  try {
    const targetID = REPAIRER_MAP[repairerName];
    const targetSheet = SpreadsheetApp.openById(targetID).getSheets()[0]; 
    const namesInThisGroup = Object.keys(REPAIRER_MAP).filter(name => REPAIRER_MAP[name] === targetID);

    let combinedFilteredData = [];
    let maxColumns = 0;

    // Determine global max columns only for allowed sheets
    ALLOWED_INDICES.forEach(idx => {
      if (allSheets[idx] && allSheets[idx].getLastColumn() > maxColumns) {
        maxColumns = allSheets[idx].getLastColumn();
      }
    });

    // 3. PULL DATA FROM ALLOWED INDICES ONLY
    ALLOWED_INDICES.forEach(idx => {
      const sheet = allSheets[idx];
      if (!sheet) return;

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      const sheetData = sheet.getRange(1, 1, lastRow, maxColumns).getValues();
      const sheetHeaders = sheetData[1]; // Header is Row 2

      const matches = sheetData.slice(1).filter(row => row[0] && namesInThisGroup.includes(row[0].toString().trim()));
      
      if (combinedFilteredData.length === 0 && matches.length > 0) {
        combinedFilteredData.push(sheetHeaders);
      }
      combinedFilteredData = combinedFilteredData.concat(matches);
    });

    // 4. STRIP H, I, K, M (Indices 7, 8, 10, 12)
    const excludeIndices = [7, 8, 10, 12];
    const finalData = combinedFilteredData.map(row => {
      return row.filter((_, colIndex) => !excludeIndices.includes(colIndex));
    });

    // 5. UPDATE TARGET
    targetSheet.clear(); 
    if (finalData.length > 0) {
      targetSheet.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
      targetSheet.getRange(1, 1, 1, finalData[0].length).setFontWeight("bold");
      targetSheet.setFrozenRows(1);
    }

    console.log("Success: latest c synced indices for " + repairerName);
    
  } catch (err) {
    console.error("Sync Error: " + err.message);
  }
}