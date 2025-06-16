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
      name: 'Asma',
      pin: '1234'
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
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    // Get parameters
    const params = e.parameter;

    // Handle get_names request
    if (params.get_names === 'true') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const playerSheet = ss.getSheetByName('Player');
      const playerData = playerSheet.getDataRange().getValues();
      const headers = playerData[0];
      const nameIdx = headers.indexOf("Name");
      const idIdx = headers.indexOf("ID");

      // Get all player names and IDs (skip header row)
      const names = playerData.slice(1).map(row => ({
        id: row[idIdx],
        name: row[nameIdx]
      }));

      return output.setContent(JSON.stringify({
        success: true,
        names: names
      }));
    }

    // Get the spreadsheet and relevant sheets
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playerSheet = ss.getSheetByName('Player');
    const roleSheet = ss.getSheetByName('Role');
    const pinSheet = ss.getSheetByName('PIN');
    const configSheet = ss.getSheetByName('Config');
    
    // If requesting configuration
    if (params.get_config === 'true') {
      const config = getConfiguration(configSheet);
      return output.setContent(JSON.stringify(config));
    }
    
    // If just requesting the list of names
    if (params.list === 'true') {
      const names = getNames(playerSheet);
      return output.setContent(JSON.stringify(names));
    }

    // Check if PIN needs setup
    if (params.check_pin === 'true') {
      const name = params.name;
      const hasPin = checkIfUserHasPin(pinSheet, name);
      return output.setContent(JSON.stringify({
        needs_setup: !hasPin
      }));
    }

    // Setup PIN
    if (params.setup_pin === 'true') {
      const name = params.name;
      const pin = params.pin;
      
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
    const name = params.name;
    const pin = params.pin;

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

    const roleData = getRoleData(e);
    return roleData;
  } catch (error) {
    return output.setContent(JSON.stringify({
      error: error.toString()
    }));
  }
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

function getRoleData(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const playerSheet = ss.getSheetByName("Player");
  const teamMissionSheet = ss.getSheetByName("Team-Mission");
  const missionSheet = ss.getSheetByName("Mission");
  const roleSheet = ss.getSheetByName("Role");
  
  const playerData = playerSheet.getDataRange().getValues();
  const teamMissionData = teamMissionSheet.getDataRange().getValues();
  const missionData = missionSheet.getDataRange().getValues();
  const roleSheetData = roleSheet.getDataRange().getValues();
  
  const headers = playerData[0];
  const teamMissionHeaders = teamMissionData[0];
  const missionHeaders = missionData[0];
  const roleHeaders = roleSheetData[0];
  
  const nameIdx = headers.indexOf("Name");
  const roleIdx = headers.indexOf("Role");
  const teamIdx = headers.indexOf("Team");
  const roleIdIdx = roleHeaders.indexOf("id");
  const roleNameIdx = roleHeaders.indexOf("Role");
  const roleIconIdx = roleHeaders.indexOf("icon");
  const roleInstructionIdx = roleHeaders.indexOf("instruction");
  const roleWinConditionIdx = roleHeaders.indexOf("win_condition");
  const roleRecommendationIdx = roleHeaders.indexOf("recommendation");
  
  // Get role mapping
  const roleMap = {};
  const roleInfoMap = {};
  for (let i = 1; i < roleSheetData.length; i++) {
    const roleId = roleSheetData[i][roleIdIdx];
    roleMap[roleId] = roleSheetData[i][roleNameIdx];
    roleInfoMap[roleId] = {
      name: roleSheetData[i][roleNameIdx],
      icon: roleSheetData[i][roleIconIdx],
      instruction: roleSheetData[i][roleInstructionIdx],
      win_condition: roleSheetData[i][roleWinConditionIdx],
      recommendation: roleSheetData[i][roleRecommendationIdx]
    };
  }
  
  const playerName = e.parameter.name;
  const playerRow = playerData.findIndex((row, idx) => idx > 0 && row[nameIdx] === playerName);
  
  if (playerRow === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Player not found" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  const playerRole = playerData[playerRow][roleIdx];
  const playerTeam = playerData[playerRow][teamIdx];
  const roleName = roleMap[playerRole];
  const roleInfo = roleInfoMap[playerRole];
  
  // Get team members (only names)
  const teamMembers = playerData.slice(1) // Skip header row
    .filter(row => row[teamIdx] === playerTeam) // Get only team members
    .map(row => row[nameIdx]); // Only include names
  
  // Get team mission data
  const teamMissionRow = teamMissionData.findIndex((row, idx) => idx > 0 && row[0] === playerTeam);
  let teamMission = null;
  
  if (teamMissionRow !== -1) {
    const missionIdIdx = teamMissionHeaders.indexOf("mission-id");
    const missionId = teamMissionData[teamMissionRow][missionIdIdx];
    
    if (missionId) {
      const missionRow = missionData.findIndex((row, idx) => idx > 0 && row[missionHeaders.indexOf("id")] === missionId);
      if (missionRow !== -1) {
        const teamMissionIdx = missionHeaders.indexOf("team-mission");
        const backdoorHintIdx = missionHeaders.indexOf("backdoor-hint");
        const installerHintIdx = missionHeaders.indexOf("installer-hint");
        
        // Get appropriate mission based on role
        if (roleName === "Backdoor" && backdoorHintIdx !== -1) {
          teamMission = missionData[missionRow][backdoorHintIdx];
        } else if (roleName === "Backdoor Installer" && installerHintIdx !== -1) {
          teamMission = missionData[missionRow][installerHintIdx];
        } else if (teamMissionIdx !== -1) {
          teamMission = missionData[missionRow][teamMissionIdx];
        }
      }
    }
  }
  
  let roleSpecificData = null;
  
  // Handle role-specific data
  switch (roleName) {
    case "Backdoor":
      if (teamMissionRow !== -1) {
        const missionIdx = teamMissionHeaders.indexOf("backdoor-mission-id");
        if (missionIdx !== -1) {
          roleSpecificData = {
            type: "backdoor_mission",
            mission: teamMissionData[teamMissionRow][missionIdx]
          };
        }
      }
      break;
      
    case "Backdoor Installer":
      if (teamMissionRow !== -1) {
        const missionIdx = teamMissionHeaders.indexOf("installer-mission");
        if (missionIdx !== -1) {
          roleSpecificData = {
            type: "installer_mission",
            mission: teamMissionData[teamMissionRow][missionIdx]
          };
        }
      }
      break;
      
    case "Legacy Code":
      if (teamMissionRow !== -1) {
        const missionIdx = teamMissionHeaders.indexOf("legacy-mission");
        if (missionIdx !== -1) {
          roleSpecificData = {
            type: "legacy_mission",
            mission: teamMissionData[teamMissionRow][missionIdx]
          };
        }
      }
      break;
      
    case "Staff Engineer":
      if (teamMissionRow !== -1) {
        const suspects = [];
        for (let i = 1; i <= 4; i++) {
          const suspectIdx = teamMissionHeaders.indexOf(`se-sus-${i}`);
          if (suspectIdx !== -1) {
            const suspect = teamMissionData[teamMissionRow][suspectIdx];
            if (suspect) {
              suspects.push(suspect);
            }
          }
        }
        if (suspects.length > 0) {
          roleSpecificData = {
            type: "se_suspects",
            suspects: suspects
          };
        }
      }
      break;
  }
  
  const response = {
    roleData: {
      name: roleInfo.name,
      icon: roleInfo.icon,
      instruction: roleInfo.instruction,
      win_condition: roleInfo.win_condition,
      recommendation: roleInfo.recommendation,
      ...roleSpecificData
    },
    team: {
      name: playerTeam,
      mission: teamMission,
      members: teamMembers
    }
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
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
    
    // Log the raw value for debugging
    if (key === 'allow_vote') {
      console.log('Raw allow_vote value:', value, 'type:', typeof value);
    }
    
    // Convert boolean values (handle both string and numeric formats)
    if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (value === 1 || value === 0) {
      value = value === 1;
    }
    // Convert other numeric strings to numbers
    else if (!isNaN(value)) {
      value = Number(value);
    }
    
    // Log the converted value
    if (key === 'allow_vote') {
      console.log('Converted allow_vote value:', value, 'type:', typeof value);
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

    // Handle voting
    if (formData.vote === 'true') {
      const voterId = formData.voterId;
      const votedFor = formData.votedFor;

      // Validate required parameters
      if (!voterId || !votedFor) {
        throw new Error('Missing required parameters for voting');
      }

      // Get the Player sheet
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const playerSheet = ss.getSheetByName('Player');
      const playerData = playerSheet.getDataRange().getValues();
      const headers = playerData[0];
      const nameIdx = headers.indexOf("Name");
      const voteIdx = headers.indexOf("Vote-1");

      if (voteIdx === -1) {
        throw new Error('Vote-1 column not found');
      }

      // Find voter's row
      let voterRowIndex = -1;
      let votedPlayerName = '';
      
      playerData.forEach((row, index) => {
        if (index > 0) {
          if (row[nameIdx] === voterId) {
            voterRowIndex = index;
          }
          if (row[nameIdx] === votedFor) {
            votedPlayerName = row[nameIdx];
          }
        }
      });

      if (voterRowIndex === -1) {
        throw new Error('Voter not found');
      }

      // Update the vote
      playerSheet.getRange(voterRowIndex + 1, voteIdx + 1).setValue(votedFor);

      return output.setContent(JSON.stringify({
        success: true,
        message: 'Vote recorded successfully',
        votedPlayer: votedPlayerName
      }));
    }
    
    // Handle leak submission
    if (formData.leak_submission === 'true') {
      const name = formData.name;
      const team = formData.team;
      const content = formData.content;

      // Validate required parameters
      if (!name || !team || !content) {
        throw new Error('Missing required parameters for leak submission');
      }

      // Verify user is Backdoor
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const playerSheet = ss.getSheetByName('Player');
      const playerData = playerSheet.getDataRange().getValues();
      const headers = playerData[0];
      const nameIdx = headers.indexOf("Name");
      const roleIdx = headers.indexOf("Role");
      const teamIdx = headers.indexOf("Team");

      const playerRow = playerData.find((row, index) => 
        index > 0 && row[nameIdx].toLowerCase().trim() === name.toLowerCase().trim()
      );

      if (!playerRow) {
        throw new Error('User not found');
      }

      if (playerRow[roleIdx] !== 'Backdoor') {
        throw new Error('Only Backdoor role can submit leaks');
      }

      if (playerRow[teamIdx] !== team) {
        throw new Error('Team mismatch');
      }

      // Update Team-Mission sheet with leak submission
      const missionSheet = ss.getSheetByName('Team-Mission');
      const missionData = missionSheet.getDataRange().getValues();
      const missionHeaders = missionData[0];
      const teamColIdx = missionHeaders.indexOf("Team");
      const submissionColIdx = missionHeaders.indexOf("backdoor-submission");

      if (submissionColIdx === -1) {
        throw new Error('Backdoor submission column not found');
      }

      // Find team row and update submission
      let teamRowIndex = -1;
      missionData.forEach((row, index) => {
        if (index > 0 && row[teamColIdx] === team) {
          teamRowIndex = index;
        }
      });

      if (teamRowIndex === -1) {
        throw new Error('Team not found in mission sheet');
      }

      // Update the submission (add 1 because sheet is 1-based)
      missionSheet.getRange(teamRowIndex + 1, submissionColIdx + 1).setValue(content);

      return output.setContent(JSON.stringify({
        success: true,
        message: 'Leak submitted successfully'
      }));
    }

    // Handle file upload (existing code)
    const team = formData.team || '';
    const name = formData.name || '';
    const file = formData.file || '';
    const filename = formData.filename || 'uploaded_file';
    const mimeType = formData.mimeType || 'image/jpeg';

    // Log extracted parameters
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

