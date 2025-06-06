function testLogging() {
  const fakeEvent = { parameter: { list: true } };
  doGet(fakeEvent);
}

function testListCase() {
  const fakeEvent = {
    parameter: {
      list: 'true'
    }
  };
  const result = doGet(fakeEvent);
  Logger.log(result.getContent());
}

function testValidatePIN() {
  const fakeEvent = {
    parameter: {
      validate: 'true',
      name: 'Mai',
      pin: '7021'
    }
  };
  const result = doGet(fakeEvent);
  Logger.log(result.getContent());
}

function testShowRole() {
  const fakeEvent = {
    parameter: {
      name: 'Mai'
    }
  };
  const result = doGet(fakeEvent);
  Logger.log(result.getContent());
}

// Add team drive folder IDs
const TEAM_DRIVE_FOLDERS = {
  'A': '1evxBZUqb0J1xlVirLq5cbWmwSqBG5iG6',
  'B': '1TMPQlFpu4Knprj_75o6t_Jho8BHlEkZq',
  'C': '1JPnus3sgyLkp6To-eSrMNy23t0V8b0s4',
  'D': '1i9UxxG8mwDv3sQ3QKF7QPe5vSjoc6o5R',
  'E': '1W_SwUT76_AqvlD6d9e98Nl0YiR7J2rnw',
  'F': '1FN7YnCEy1tsUwqRiFsEspDkrTYWQhsVu'
};

function doGet(e) {
  // Set CORS headers
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Get the spreadsheet and relevant sheets
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = ss.getSheetByName('Player');
  const roleSheet = ss.getSheetByName('Role');
  const pinSheet = ss.getSheetByName('PIN');
  const configSheet = ss.getSheetByName('Config');
  
  // If requesting configuration
  if (e.parameter.get_config === 'true') {
    const config = getConfiguration(configSheet);
    return output.setContent(JSON.stringify(config));
  }
  
  // If just requesting the list of names
  if (e.parameter.list === 'true') {
    const names = getNames(playerSheet);
    return output.setContent(JSON.stringify(names));
  }

  // Check if PIN needs setup
  if (e.parameter.check_pin === 'true') {
    const name = e.parameter.name;
    const hasPin = checkIfUserHasPin(pinSheet, name);
    return output.setContent(JSON.stringify({
      needs_setup: !hasPin
    }));
  }

  // Setup PIN
  if (e.parameter.setup_pin === 'true') {
    const name = e.parameter.name;
    const pin = e.parameter.pin;
    
    try {
      // Validate inputs
      if (!name || !pin) {
        throw new Error('ข้อมูลไม่ครบถ้วน');
      }
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        throw new Error('รหัส PIN ต้องเป็นตัวเลข 4 หลัก');
      }
      
      // Check if PIN already exists
      if (checkIfUserHasPin(pinSheet, name)) {
        throw new Error('มีการตั้งค่ารหัส PIN แล้ว');
      }

      // Save the PIN
      saveUserPin(pinSheet, name, pin);
      return output.setContent(JSON.stringify({
        success: true
      }));
    } catch (error) {
      return output.setContent(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  }

  // Get role information (now requires PIN)
  const name = e.parameter.name;
  const pin = e.parameter.pin;

  if (!name || !pin) {
    return output.setContent(JSON.stringify({
      error: 'Name and PIN parameters are required'
    }));
  }

  // Verify PIN first
  const isValidPin = validatePin(pinSheet, name, pin);
  if (!isValidPin) {
    return output.setContent(JSON.stringify({
      error: 'Invalid PIN'
    }));
  }

  const roleData = getRoleData(playerSheet, roleSheet, name);
  return output.setContent(JSON.stringify(roleData));
}

function getNames(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Name");
  return data.slice(1) // Skip header row
    .map(row => row[nameIdx]) // Get name column
    .filter(name => name); // Remove empty rows
}

function checkIfUserHasPin(pinSheet, name) {
  const data = pinSheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Name");
  const pinIdx = headers.indexOf("PIN");
  // Skip header row, search for name in name column
  return data.slice(1).some(row => row[nameIdx] === name && row[pinIdx]);
}

function saveUserPin(pinSheet, name, pin) {
  const data = pinSheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Name");
  const pinIdx = headers.indexOf("PIN");
  
  // Find existing row or get new row
  let rowIndex = data.findIndex((row, index) => index > 0 && row[nameIdx] === name);
  
  if (rowIndex === -1) {
    // Add new row
    rowIndex = pinSheet.getLastRow() + 1;
    const newRow = Array(headers.length).fill("");  // Create empty row with correct length
    newRow[nameIdx] = name;
    newRow[pinIdx] = pin;
    pinSheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
  } else {
    // Update existing row (add 1 because rowIndex is 0-based but sheet is 1-based)
    pinSheet.getRange(rowIndex + 1, pinIdx + 1).setValue(pin);
  }
}

function validatePin(pinSheet, name, pin) {
  const data = pinSheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf("Name");
  const pinIdx = headers.indexOf("PIN");
  // Skip header row, find matching name and PIN
  const userRow = data.slice(1).find(row => row[nameIdx] === name);
  // Convert both PINs to strings and trim for comparison
  return userRow && userRow[pinIdx].toString().trim() === pin.toString().trim();
}

function getRoleData(playerSheet, roleSheet, name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerData = playerSheet.getDataRange().getValues();
  const roleData = roleSheet.getDataRange().getValues();
  const missionSheet = ss.getSheetByName('Team-Mission');
  const missionDataSheet = ss.getSheetByName('Mission');
  
  const playerHeaders = playerData[0];
  const roleHeaders = roleData[0];
  
  // Get column indexes
  const nameIdx = playerHeaders.indexOf("Name");
  const roleIdx = playerHeaders.indexOf("Role");
  const teamIdx = playerHeaders.indexOf("Team");
  
  const roleKeyIdx = roleHeaders.indexOf("Role");
  const instIdx = roleHeaders.indexOf("Instruction");
  const iconIdx = roleHeaders.indexOf("Icon");
  const specificDataIdx = roleHeaders.indexOf("SpecificData");
  
  // Find player row
  const playerRow = playerData.find((row, index) => index > 0 && row[nameIdx].toLowerCase().trim() === name.toLowerCase().trim());
  if (!playerRow) return null;
  
  const playerRole = playerRow[roleIdx];
  const team = playerRow[teamIdx];
  
  // Find instruction and specific data for the role
  let instruction = "No instruction available";
  let roleIcon = "💻"; // Default icon
  let roleSpecificConfig = null;
  const roleInstructionRow = roleData.find((row, index) => index > 0 && row[roleKeyIdx] === playerRole);
  if (roleInstructionRow) {
    instruction = roleInstructionRow[instIdx];
    if (iconIdx !== -1 && roleInstructionRow[iconIdx]) {
      roleIcon = roleInstructionRow[iconIdx];
    }
    // Try to parse role-specific configuration if available
    if (specificDataIdx !== -1 && roleInstructionRow[specificDataIdx]) {
      try {
        roleSpecificConfig = JSON.parse(roleInstructionRow[specificDataIdx]);
      } catch (e) {
        console.error('Failed to parse role specific data for ' + playerRole);
      }
    }
  }
  
  // Get all team members (without roles)
  const teamMembers = playerData.slice(1) // Skip header row
    .filter(row => row[teamIdx] === team) // Get only team members
    .map(row => row[nameIdx]) // Get only names
    .filter(memberName => memberName !== playerRow[nameIdx]); // Exclude current player
  
  // Get mission data
  const teamMissionData = missionSheet.getDataRange().getValues();
  const missionData = missionDataSheet.getDataRange().getValues();
  
  // Get column indexes for Team-Mission sheet
  const teamMissionHeaders = teamMissionData[0];
  const teamMissionTeamIdx = teamMissionHeaders.indexOf("Team");
  const missionIdIdx = teamMissionHeaders.indexOf("mission-id");
  
  // Get column indexes for Mission sheet
  const missionHeaders = missionData[0];
  const idIdx = missionHeaders.indexOf("id");
  const teamMissionIdx = missionHeaders.indexOf("Team Mission");
  const legacyMissionIdx = missionHeaders.indexOf("Legacy code Mission");
  
  // Find team's mission
  const teamMissionRow = teamMissionData.find((row, index) => index > 0 && row[teamMissionTeamIdx] === team);
  let teamMission = null;
  let legacyMission = null;
  
  if (teamMissionRow) {
    const missionId = teamMissionRow[missionIdIdx];
    const missionRow = missionData.find((row, index) => index > 0 && row[idIdx] === missionId);
    if (missionRow) {
      teamMission = missionRow[teamMissionIdx];
      legacyMission = missionRow[legacyMissionIdx];
    }
  }
  
  // Create response object
  const response = {
    name: playerRow[nameIdx],
    role: playerRole,
    roleIcon: roleIcon,
    team: team,
    instruction: instruction,
    teamMembers: teamMembers,
    teamMission: teamMission
  };
  
  // Add role-specific data based on role
  switch (playerRole) {
    case "EM":
    case "AI":
      // For EM and AI roles, show team members with roles
      response.roleData = {
        type: "team_list",
        role: playerRole,
        members: playerData.slice(1) // Skip header row
          .filter(row => row[teamIdx] === team) // Get only team members
          .map(row => ({
            name: row[nameIdx],
            role: row[roleIdx]
          }))
      };
      break;

    case "Legacy code":
      // For Legacy code role, include the legacy mission
      response.roleData = {
        type: "legacy_mission",
        role: playerRole,
        mission: legacyMission
      };
      break;
      
    default:
      // Handle other roles that might have specific data configured
      if (roleSpecificConfig) {
        response.roleData = {
          type: roleSpecificConfig.type,
          role: playerRole,
          ...roleSpecificConfig.data
        };
      }
      break;
  }
  
  return response;
}

function getConfiguration(sheet) {
  if (!sheet) return { error: 'Configuration sheet not found' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roleSheet = ss.getSheetByName('Role');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx = headers.indexOf("Key");
  const valueIdx = headers.indexOf("Value");
  const descriptionIdx = headers.indexOf("Description");
  
  if (keyIdx === -1 || valueIdx === -1) {
    return { error: 'Invalid configuration sheet format' };
  }
  
  const config = {};
  
  // Get basic configuration
  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const key = row[keyIdx];
    let value = row[valueIdx];
    
    // Convert string boolean values to actual booleans
    if (value === 'true' || value === 'false') {
      value = value === 'true';
    }
    // Convert numeric strings to numbers
    else if (!isNaN(value)) {
      value = Number(value);
    }
    
    config[key] = value;
  }

  // Add role icons to configuration
  if (roleSheet) {
    const roleData = roleSheet.getDataRange().getValues();
    const roleHeaders = roleData[0];
    const roleKeyIdx = roleHeaders.indexOf("Role");
    const iconIdx = roleHeaders.indexOf("Icon");

    if (roleKeyIdx !== -1 && iconIdx !== -1) {
      const roleIcons = {};
      // Skip header row
      for (let i = 1; i < roleData.length; i++) {
        const row = roleData[i];
        const role = row[roleKeyIdx];
        const icon = row[iconIdx];
        if (role && icon) {
          roleIcons[role] = icon;
        }
      }
      config.roleIcons = roleIcons;
    }
  }
  
  return config;
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Get form data and validate parameters first
    if (!e || !e.parameter) {
      throw new Error('No form data received');
    }

    const formData = e.parameter;
    
    // Log received parameters for debugging
    Logger.log('Received parameters:');
    Logger.log('Raw formData:', JSON.stringify(formData));
    
    // Extract parameters safely
    const team = formData.team || '';
    const name = formData.name || '';
    const file = formData.file || '';
    const filename = formData.filename || 'uploaded_file';
    const mimeType = formData.mimeType || 'image/jpeg';

    // Log extracted parameters
    Logger.log('Extracted parameters:');
    Logger.log('team:', team);
    Logger.log('name:', name);
    Logger.log('filename:', filename);
    Logger.log('mimeType:', mimeType);
    Logger.log('file length:', file.length);

    // Check each parameter and create detailed error message
    const missingParams = [];
    if (!team) missingParams.push('team');
    if (!name) missingParams.push('name');
    if (!file) missingParams.push('file');
    
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    try {
      // Convert base64 to blob
      const fileBlob = Utilities.newBlob(Utilities.base64Decode(file), mimeType, filename);

      // Get the appropriate folder
      const folderId = TEAM_DRIVE_FOLDERS[team.toUpperCase()];
      if (!folderId) {
        throw new Error('Invalid team');
      }
      const folder = DriveApp.getFolderById(folderId);

      // Create file in Drive
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const finalFileName = `${team}_${name}_${timestamp}`;
      const driveFile = folder.createFile(fileBlob);
      driveFile.setName(finalFileName);
      const fileUrl = driveFile.getUrl();

      // Save to spreadsheet
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheetName = `team-submission-${team.toLowerCase()}`;
      let sheet = ss.getSheetByName(sheetName);
      
      // Create sheet if it doesn't exist
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(['Timestamp', 'Uploader', 'URL']);
      }

      // Add submission record
      sheet.appendRow([new Date(), name, fileUrl]);

      return output.setContent(JSON.stringify({
        success: true,
        fileUrl: fileUrl
      }));

    } catch (error) {
      Logger.log('Error processing file:', error.message);
      throw new Error(`Error processing file: ${error.message}`);
    }

  } catch (error) {
    Logger.log('Error in doPost:', error.message);
    return output.setContent(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

