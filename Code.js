function doGet(e) {
  const name = e.parameter.name;
  const listMode = e.parameter.list === "true";
  const pin = e.parameter.pin;
  const validateMode = e.parameter.validate === "true";

  const ss = SpreadsheetApp.openById("1_txTSYWkoNV8RBlO2nSEScoKA3gHl4woIBhd5ECWcqQ");
  const playerSheet = ss.getSheetByName("Player");
  const roleSheet = ss.getSheetByName("Role");
  const pinSheet = ss.getSheetByName("PIN");

  const playerData = playerSheet.getDataRange().getValues();
  const roleData = roleSheet.getDataRange().getValues();
  const pinData = pinSheet.getDataRange().getValues();

  const playerHeaders = playerData[0];
  const roleHeaders = roleData[0];
  const pinHeaders = pinData[0];

  // Debug headers
  console.log("Player Headers:", playerHeaders);
  console.log("Role Headers:", roleHeaders);
  console.log("PIN Headers:", pinHeaders);

  const nameIdx = playerHeaders.indexOf("Name");
  const roleIdx = playerHeaders.indexOf("Role");
  const teamIdx = playerHeaders.indexOf("Team");

  const roleKeyIdx = roleHeaders.indexOf("Role");
  const instIdx = roleHeaders.indexOf("Instruction");

  const pinNameIdx = pinHeaders.indexOf("Name");
  const pinValueIdx = pinHeaders.indexOf("PIN");

  // Debug column indexes
  console.log("Column Indexes - Name:", nameIdx, "Role:", roleIdx, "Team:", teamIdx);
  console.log("Role Sheet Indexes - Role:", roleKeyIdx, "Instruction:", instIdx);
  console.log("PIN Sheet Indexes - Name:", pinNameIdx, "PIN:", pinValueIdx);

  // Handle PIN validation
  if (validateMode && name && pin) {
    for (let i = 1; i < pinData.length; i++) {
      const row = pinData[i];
      if (row[pinNameIdx].toLowerCase().trim() === name.toLowerCase().trim()) {
        const isValid = row[pinValueIdx].toString() === pin.toString();
        return ContentService
          .createTextOutput(JSON.stringify({ valid: isValid }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ valid: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Handle role data fetching
  function getRoleSpecificData(playerRole, team, playerData, nameIdx, roleIdx, teamIdx) {
    let roleData = null;
    
    // If player is EM, return all team members and their roles
    if (playerRole === "EM") {
      roleData = {
        type: "team_list",
        members: playerData.slice(1) // Skip header row
          .filter(row => row[teamIdx] === team) // Get only team members
          .map(row => ({
            name: row[nameIdx],
            role: row[roleIdx]
          }))
      };
    }
    
    return roleData;
  }

  // Handle list mode
  if (listMode) {
    const names = playerData.slice(1).map(row => row[nameIdx]);
    return ContentService
      .createTextOutput(JSON.stringify(names))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (!name) {
    return ContentService.createTextOutput("Missing 'name' parameter");
  }

  // Debug search name
  console.log("Searching for name:", name);

  for (let i = 1; i < playerData.length; i++) {
    const row = playerData[i];
    const currentName = row[nameIdx].toLowerCase().trim();
    const searchName = name.toLowerCase().trim();
    
    // Debug each comparison
    console.log(`Comparing '${currentName}' with '${searchName}'`);
    
    if (currentName === searchName) {
      const playerRole = row[roleIdx];
      const team = row[teamIdx];

      // Debug found player data
      console.log("Found player - Role:", playerRole, "Team:", team);

      let instruction = "No instruction available";
      for (let j = 1; j < roleData.length; j++) {
        if (roleData[j][roleKeyIdx] === playerRole) {
          instruction = roleData[j][instIdx];
          console.log("Found instruction for role:", playerRole);
          break;
        }
      }

      // Get role-specific data
      const roleSpecificData = getRoleSpecificData(playerRole, team, playerData, nameIdx, roleIdx, teamIdx);

      const result = {
        name: row[nameIdx],
        team: team,
        role: playerRole,
        instruction: instruction,
        roleData: roleSpecificData
      };

      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // Debug not found case
  console.log("Name not found in spreadsheet");
  return ContentService.createTextOutput("Not found");
}
