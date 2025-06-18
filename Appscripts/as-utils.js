function regenerateGroupsAndRoles() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player");
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const teamIdx = headers.indexOf("Team");
    const posIdx = headers.indexOf("Position");
  
    const nonEMRows = [];
    const emMap = {}; // team slot -> EM row
  
    // แยก EM ออกจากผู้เล่น
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const position = row[posIdx];
      if (position === "EM") {
        emMap[i] = row; // จำตำแหน่งไว้
      } else {
        nonEMRows.push({ index: i + 1, values: row });
      }
    }
  
    // สุ่มลำดับผู้เล่น
    const shuffled = nonEMRows.sort(() => Math.random() - 0.5);
  
    const teamNames = ['A', 'B', 'C', 'D', 'E', 'F'];
    const teamCount = teamNames.length;
    const teamSize = Math.floor(shuffled.length / teamCount);
    const overflow = shuffled.length % teamCount;
  
    let current = 0;
    for (let t = 0; t < teamCount; t++) {
      const size = teamSize + (t < overflow ? 1 : 0);
      const team = teamNames[t];
  
      for (let j = 0; j < size; j++) {
        const row = shuffled[current].index;
        sheet.getRange(row, teamIdx + 1).setValue(team);
        current++;
      }
    }
  
    // กำหนดทีมให้ EM ตามลำดับ
    const emRows = Object.keys(emMap);
    for (let i = 0; i < emRows.length; i++) {
      const row = parseInt(emRows[i]);
      const team = teamNames[i];
      sheet.getRange(row + 1, teamIdx + 1).setValue(team);
    }
  
    SpreadsheetApp.flush();
    Logger.log("กลุ่มถูกสุ่มใหม่เรียบร้อยแล้ว");
  
    // แจกบทบาทใหม่หลังจากจัดกลุ่ม
    regenerateRoles();
  }
  
  function regenerateRoles() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Player");
    const roleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Role");
    const data = sheet.getDataRange().getValues();
    const roleData = roleSheet.getDataRange().getValues();
    const headers = data[0];
    const roleHeaders = roleData[0];
    const teamIdx = headers.indexOf("Team");
    const posIdx = headers.indexOf("Position");
    const roleIdx = headers.indexOf("Role");
    const roleIdIdx = roleHeaders.indexOf("id");
    const roleNameIdx = roleHeaders.indexOf("Role");
    const roleMinIdx = roleHeaders.indexOf("min");
    const roleMaxIdx = roleHeaders.indexOf("max");
  
    // Log role headers for debugging
    Logger.log("Role Headers: " + JSON.stringify(roleHeaders));
  
    const teamMap = {};
  
    // จัดกลุ่มตามทีม
    for (let i = 1; i < data.length; i++) {
      const team = data[i][teamIdx];
      if (!teamMap[team]) teamMap[team] = [];
      teamMap[team].push({ row: i + 1, position: data[i][posIdx] });
    }
  
    // Get role data from Role sheet
    const roles = roleData.slice(1).map(row => ({
      id: row[roleIdIdx],
      name: row[roleNameIdx],
      min: row[roleMinIdx] || 0,
      max: row[roleMaxIdx] || 0
    }));
  
    // Log roles for debugging
    Logger.log("Found Roles: " + JSON.stringify(roles));
  
    // ล้างค่า Role ก่อน
    for (let i = 1; i < data.length; i++) {
      sheet.getRange(i + 1, roleIdx + 1).setValue("");
    }
  
    // กำหนดบทบาทในแต่ละทีม
    for (const team in teamMap) {
      const members = teamMap[team].filter(p => p.position !== "EM");
      const em = teamMap[team].find(p => p.position === "EM");

      // กำหนด EM เป็น AI
      if (em) {
        const aiRole = roles.find(r => r.name === "AI");
        if (aiRole) {
          sheet.getRange(em.row, roleIdx + 1).setValue(aiRole.id);
          Logger.log(`Assigned AI role to EM at row ${em.row}`);
        }
      }

      // Remove AI role from assignable roles
      const assignableRoles = roles.filter(r => r.name !== "AI");
  
      // สุ่มผู้เล่นเพื่อกำหนดบทบาท
      const shuffled = members.sort(() => Math.random() - 0.5);
      let currentMemberIndex = 0;
  
      Logger.log(`Assigning roles for team ${team}:`);
      Logger.log(`Number of members: ${shuffled.length}`);
  
      // First pass: Assign minimum required roles
      for (const role of assignableRoles) {
        if (role.min > 0) {
          for (let i = 0; i < role.min; i++) {
            if (currentMemberIndex < shuffled.length) {
              const playerRow = shuffled[currentMemberIndex].row;
              sheet.getRange(playerRow, roleIdx + 1).setValue(role.id);
              Logger.log(`Assigned minimum role ${role.name} (${role.id}) to row ${playerRow}`);
              currentMemberIndex++;
            } else {
              Logger.log(`WARNING: Not enough players for minimum role ${role.name}`);
            }
          }
        }
      }
  
      // Second pass: Fill remaining roles up to max
      const remainingMembers = shuffled.slice(currentMemberIndex);
      const remainingRoles = assignableRoles.filter(role => role.max > role.min);
      
      for (const member of remainingMembers) {
        // Find a role that hasn't reached its max
        const availableRole = remainingRoles.find(role => {
          const currentCount = shuffled.slice(0, currentMemberIndex)
            .filter(p => sheet.getRange(p.row, roleIdx + 1).getValue() === role.id)
            .length;
          return currentCount < role.max;
        });
  
        if (availableRole) {
          sheet.getRange(member.row, roleIdx + 1).setValue(availableRole.id);
          Logger.log(`Assigned additional role ${availableRole.name} (${availableRole.id}) to row ${member.row}`);
        } else {
          // If no role is available, assign as Team Member
          const teamMemberRole = assignableRoles.find(r => r.name === "Team Member");
          if (teamMemberRole) {
            sheet.getRange(member.row, roleIdx + 1).setValue(teamMemberRole.id);
            Logger.log(`Assigned Team Member role to row ${member.row}`);
          }
        }
        currentMemberIndex++;
      }
    }
  
    SpreadsheetApp.flush();
    Logger.log("บทบาทถูกกำหนดใหม่เรียบร้อยแล้ว");
  }

  function regenerateSuspectNames() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const playerSheet = ss.getSheetByName("Player");
    const teamMissionSheet = ss.getSheetByName("Team-Mission");
    
    // Get all data
    const playerData = playerSheet.getDataRange().getValues();
    const teamMissionData = teamMissionSheet.getDataRange().getValues();
    
    // Get column indices
    const playerHeaders = playerData[0];
    const missionHeaders = teamMissionData[0];
    
    const nameIdx = playerHeaders.indexOf("Name");
    const teamIdx = playerHeaders.indexOf("Team");
    const roleIdx = playerHeaders.indexOf("Role");
    const teamColIdx = missionHeaders.indexOf("Team");
    
    // Find indices for suspect columns
    const suspectColumns = [];
    for (let i = 1; i <= 4; i++) {
      const idx = missionHeaders.indexOf(`se-sus-${i}`);
      if (idx === -1) {
        throw new Error(`Column se-sus-${i} not found in Team-Mission sheet`);
      }
      suspectColumns.push(idx);
    }
    
    // Process each team
    for (let teamRow = 1; teamRow < teamMissionData.length; teamRow++) {
      const team = teamMissionData[teamRow][teamColIdx];
      if (!team) continue;
      
      Logger.log(`Processing team ${team}`);
      
      // Get eligible team members (exclude AI and Staff Engineer)
      const teamMembers = playerData.slice(1) // Skip header
        .filter(row => {
          const roleId = parseInt(row[roleIdx]); // Convert to number for strict comparison
          return row[teamIdx] === team && roleId !== 7 && roleId !== 4; // Exclude AI (7) and SE (4)
        });
  
      Logger.log(`Eligible team members: ${JSON.stringify(teamMembers)}`);
  
      // Find Backdoor and Legacy Code members
      const backdoor = teamMembers.find(member => parseInt(member[roleIdx]) === 1); // Backdoor role ID = 1
      const legacyCode = teamMembers.find(member => parseInt(member[roleIdx]) === 3); // Legacy Code role ID = 3
      
      if (!backdoor || !legacyCode) {
        Logger.log(`Missing required roles in team ${team}. Backdoor: ${!!backdoor}, Legacy Code: ${!!legacyCode}`);
        continue;
      }
      
      // Create suspect list starting with Backdoor and Legacy Code
      const suspects = [backdoor[nameIdx], legacyCode[nameIdx]];
      
      // Get remaining members (excluding those already in suspects)
      const remainingMembers = teamMembers
        .filter(member => member[nameIdx] !== backdoor[nameIdx] && member[nameIdx] !== legacyCode[nameIdx]);
      
      // Shuffle remaining members and take 2
      const additionalSuspects = remainingMembers
        .sort(() => Math.random() - 0.5)
        .slice(0, 2)
        .map(member => member[nameIdx]);
      
      // Combine and shuffle all suspects
      const allSuspects = [...suspects, ...additionalSuspects].sort(() => Math.random() - 0.5);
      
      // Update Team-Mission sheet with suspects
      for (let i = 0; i < suspectColumns.length; i++) {
        teamMissionSheet.getRange(teamRow + 1, suspectColumns[i] + 1).setValue(allSuspects[i]);
      }
      
      Logger.log(`Updated suspects for team ${team}: ${allSuspects.join(', ')}`);
    }
    
    SpreadsheetApp.flush();
    Logger.log("Suspect names generated for all Staff Engineers");
  }