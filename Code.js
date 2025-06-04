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

  // Validate PIN
  if (e.parameter.validate === 'true') {
    const name = e.parameter.name;
    const pin = e.parameter.pin;
    const isValid = validatePin(pinSheet, name, pin);
    return output.setContent(JSON.stringify({
      valid: isValid
    }));
  }

  // Get role information
  const name = e.parameter.name;
  if (!name) {
    return output.setContent(JSON.stringify({
      error: 'Name parameter is required'
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
  const playerData = playerSheet.getDataRange().getValues();
  const roleData = roleSheet.getDataRange().getValues();
  
  const playerHeaders = playerData[0];
  const roleHeaders = roleData[0];
  
  // Get column indexes
  const nameIdx = playerHeaders.indexOf("Name");
  const roleIdx = playerHeaders.indexOf("Role");
  const teamIdx = playerHeaders.indexOf("Team");
  
  const roleKeyIdx = roleHeaders.indexOf("Role");
  const instIdx = roleHeaders.indexOf("Instruction");
  const specificDataIdx = roleHeaders.indexOf("SpecificData");
  
  // Find player row
  const playerRow = playerData.find((row, index) => index > 0 && row[nameIdx].toLowerCase().trim() === name.toLowerCase().trim());
  if (!playerRow) return null;
  
  const playerRole = playerRow[roleIdx];
  const team = playerRow[teamIdx];
  
  // Find instruction and specific data for the role
  let instruction = "No instruction available";
  let roleSpecificConfig = null;
  const roleInstructionRow = roleData.find((row, index) => index > 0 && row[roleKeyIdx] === playerRole);
  if (roleInstructionRow) {
    instruction = roleInstructionRow[instIdx];
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
  
  // Create response object
  const response = {
    name: playerRow[nameIdx],
    role: playerRole,
    team: team,
    instruction: instruction,
    teamMembers: teamMembers
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
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIdx = headers.indexOf("Key");
  const valueIdx = headers.indexOf("Value");
  const descriptionIdx = headers.indexOf("Description");
  
  if (keyIdx === -1 || valueIdx === -1) {
    return { error: 'Invalid configuration sheet format' };
  }
  
  const config = {};
  
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
  
  return config;
}

