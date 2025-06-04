// Get API URL from config
const API_URL = ENV.API_URL;

let currentMode = 'login'; // 'login' or 'setup'
let currentRole = ''; // Store current user's role
let appConfig = {}; // Store application configuration

// Cookie handling functions
function setCookie(name, value, days = 30) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

window.onload = async () => {
  const dropdown = document.getElementById("nameDropdown");
  const loadingText = document.getElementById("loadingText");
  const pinLoginContainer = document.getElementById("pinLoginContainer");
  const pinSetupContainer = document.getElementById("pinSetupContainer");
  const actionButton = document.getElementById("actionButton");
  const newPin = document.getElementById("newPin");
  const confirmPin = document.getElementById("confirmPin");

  try {
    // Set initial states
    loadingText.textContent = 'กำลังโหลดรายชื่อผู้ใช้งาน รอแป๊ปปป 🚅';
    loadingText.style.display = 'flex';
    dropdown.style.display = 'none';

    // Load configuration first
    const configRes = await fetch(`${API_URL}?get_config=true`);
    appConfig = await configRes.json();
    
    if (appConfig.error) {
      console.error('Configuration error:', appConfig.error);
    }

    // First fetch and populate the names
    const res = await fetch(`${API_URL}?list=true`);
    const names = await res.json();

    // Clear existing options except the default one
    while (dropdown.options.length > 1) {
      dropdown.remove(1);
    }

    // Add new options
    names.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      dropdown.appendChild(option);
    });

    // Hide loading text and show dropdown after names are loaded
    loadingText.style.display = 'none';
    dropdown.style.display = 'block';

    // Now that names are loaded, try to restore the saved selection
    const savedName = getCookie('selectedUser');
    if (savedName && names.includes(savedName)) {
      dropdown.value = savedName;
      // Trigger the change event to load user data
      const event = new Event('change');
      dropdown.dispatchEvent(event);
    }

    // Show appropriate container when name is selected
    dropdown.addEventListener('change', async () => {
      if (dropdown.value) {
        // Save selection to cookie
        setCookie('selectedUser', dropdown.value);

        // Hide PIN input while checking
        pinLoginContainer.classList.add('hidden');
        pinSetupContainer.classList.add('hidden');
        
        // Show checking indicator
        const checkingSpan = document.createElement('span');
        checkingSpan.className = 'checking-pin';
        checkingSpan.textContent = 'เช็คแปปว่ามี PIN ยัง ใจเย็นๆนะของรีบทำ';
        dropdown.parentElement.appendChild(checkingSpan);

        // Disable dropdown while checking
        dropdown.disabled = true;
        
        try {
          // Check if PIN needs setup
          const checkRes = await fetch(`${API_URL}?check_pin=true&name=${encodeURIComponent(dropdown.value)}`);
          const checkData = await checkRes.json();

          if (checkData.needs_setup) {
            currentMode = 'setup';
            pinSetupContainer.classList.remove('hidden');
            actionButton.textContent = '$ execute --setup-pin';
          } else {
            currentMode = 'login';
            pinLoginContainer.classList.remove('hidden');
            actionButton.textContent = '$ execute --show-role';
          }
          
          resetPinFields();
        } catch (error) {
          console.error('Error checking PIN:', error);
        } finally {
          // Remove checking indicator and re-enable dropdown
          const checkingSpan = dropdown.parentElement.querySelector('.checking-pin');
          if (checkingSpan) checkingSpan.remove();
          dropdown.disabled = false;
        }
      } else {
        // Clear cookie if no selection
        setCookie('selectedUser', '', -1);
        pinLoginContainer.classList.add('hidden');
        pinSetupContainer.classList.add('hidden');
      }
      updateButtonState();
    });

    // Enable/disable button based on input
    document.getElementById("pinInput").addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      updateButtonState();
    });

    newPin.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      updateButtonState();
    });

    confirmPin.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      updateButtonState();
    });

  } catch (e) {
    loadingText.textContent = "ไม่สามารถโหลดรายชื่อได้ กรุณารีเฟรชหน้าเว็บ";
    loadingText.classList.remove('text-gray-500');
    loadingText.classList.add('text-red-500');
  }
};

function updateButtonState() {
  const dropdown = document.getElementById("nameDropdown");
  const actionButton = document.getElementById("actionButton");
  
  if (currentMode === 'login') {
    const pinInput = document.getElementById("pinInput");
    actionButton.disabled = !dropdown.value || pinInput.value.length !== 4;
  } else {
    const newPin = document.getElementById("newPin");
    const confirmPin = document.getElementById("confirmPin");
    actionButton.disabled = !dropdown.value || newPin.value.length !== 4 || confirmPin.value.length !== 4;
  }
}

function resetPinFields() {
  document.getElementById("pinInput").value = '';
  document.getElementById("newPin").value = '';
  document.getElementById("confirmPin").value = '';
  document.getElementById("pinError").classList.add('hidden');
  document.getElementById("pinSetupError").classList.add('hidden');
}

function getRoleEmoji(role) {
  // Define role-specific emojis
  const roleEmojis = {
    'AI': '🤖',
    'Backdoor': '🔑',
    'Backdoor Installer': '🦹',
    'Team Member': '👨‍💻',
    'Staff Engineer': '👨‍💻👑',
  };
  return roleEmojis[role] || '💻'; // Default emoji for unknown roles
}

async function handleAction() {
  if (currentMode === 'setup') {
    await setupPin();
  } else {
    await fetchRole();
  }
}

async function setupPin() {
  const button = document.getElementById("actionButton");
  const name = document.getElementById("nameDropdown").value;
  const newPin = document.getElementById("newPin").value;
  const confirmPin = document.getElementById("confirmPin").value;
  const pinSetupError = document.getElementById("pinSetupError");
  const pinSetupErrorText = document.getElementById("pinSetupErrorText");

  if (newPin !== confirmPin) {
    pinSetupError.classList.remove('hidden');
    pinSetupErrorText.textContent = "รหัส PIN ไม่ตรงกัน กรุณาลองใหม่";
    return;
  }

  try {
    button.classList.add("btn-loading");
    button.disabled = true;

    const res = await fetch(`${API_URL}?setup_pin=true&name=${encodeURIComponent(name)}&pin=${newPin}`);
    const data = await res.json();

    if (data.success) {
      // Switch to login mode
      currentMode = 'login';
      document.getElementById("pinSetupContainer").classList.add('hidden');
      document.getElementById("pinLoginContainer").classList.remove('hidden');
      button.textContent = '$ execute --show-role';
      resetPinFields();
    } else {
      pinSetupError.classList.remove('hidden');
      pinSetupErrorText.textContent = data.error || "ไม่สามารถตั้งค่ารหัส PIN ได้ กรุณาลองใหม่";
    }
  } catch {
    pinSetupError.classList.remove('hidden');
    pinSetupErrorText.textContent = "เกิดข้อผิดพลาด กรุณาลองใหม่";
  } finally {
    button.classList.remove("btn-loading");
    updateButtonState();
  }
}

async function fetchRole() {
  const button = document.getElementById("actionButton");
  const result = document.getElementById("result");
  const actionButtons = document.getElementById("actionButtons");
  const backdoorAction = document.getElementById("backdoorAction");
  const voteAction = document.getElementById("voteAction");
  const teamAction = document.getElementById("teamAction");
  const name = document.getElementById("nameDropdown").value;
  const pin = document.getElementById("pinInput").value;
  const pinError = document.getElementById("pinError");
  const nameSelectContainer = document.getElementById("nameSelectContainer");
  const instructionText = document.querySelector('.text-gray-400.mb-6'); // Select the instruction text element

  if (!name) return alert("กรุณาเลือกชื่อ");
  if (!pin || pin.length !== 4) return alert("กรุณาใส่รหัส PIN 4 หลัก");

  try {
    // Show loading state
    button.classList.add("btn-loading");
    button.disabled = true;

    // First validate PIN
    const validateRes = await fetch(`${API_URL}?validate=true&name=${encodeURIComponent(name)}&pin=${pin}`);
    const validateData = await validateRes.json();

    if (!validateData.valid) {
      pinError.classList.remove('hidden');
      return;
    }

    // PIN is valid, fetch role
    const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}`);
    const text = await res.text();
    const data = JSON.parse(text);
    
    // Store current role
    currentRole = data.role;
    
    // Hide name selection, PIN input sections, and instruction text
    nameSelectContainer.style.display = 'none';
    button.style.display = 'none';
    instructionText.style.display = 'none';
    
    pinError.classList.add('hidden');
    result.classList.remove('hidden');
    result.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-green-400">&gt;</span>
          <h3 class="text-xl font-semibold text-white">${data.name}</h3>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-yellow-400">&gt;</span>
          <div class="font-medium text-gray-200">บทบาท: <span class="text-white">${data.role} ${getRoleEmoji(data.role)}</span></div>
        </div>
        <div class="flex items-start gap-2">
          <span class="text-blue-400">&gt;</span>
          <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.instruction}</p>
        </div>

        ${data.teamMembers ? `
          <div class="mt-6">
            <h4 class="text-lg font-semibold text-white mb-3">
              <span class="text-yellow-400">&gt;</span> สมาชิกในทีม ${data.team}:
            </h4>
            <div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div class="grid grid-cols-2 gap-2">
                ${data.teamMembers.map(member => `
                  <div class="text-white">${member}</div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}
        ${renderRoleSpecificData(data.roleData)}
      </div>
    `;

    // Show and configure action buttons based on role
    actionButtons.classList.remove('hidden');
    
    // Configure Backdoor action button
    if (currentRole === 'Backdoor') {
      backdoorAction.classList.remove('hidden');
      const isLeakEnabled = appConfig.allow_submit_leak === true;
      backdoorAction.disabled = !isLeakEnabled;
      backdoorAction.title = !isLeakEnabled ? 'This action is currently disabled' : '';
      if (!isLeakEnabled) {
        backdoorAction.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        backdoorAction.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } else {
      backdoorAction.classList.add('hidden');
    }

    // Configure Vote and Team action buttons
    if (currentRole !== 'AI') {
      // Team button
      teamAction.classList.remove('hidden');
      const isTeamEnabled = appConfig.allow_submit_team === true;
      teamAction.disabled = !isTeamEnabled;
      teamAction.title = !isTeamEnabled ? 'Team submissions are currently disabled' : '';
      teamAction.textContent = `$ execute --task-${data.team}`;
      if (!isTeamEnabled) {
        teamAction.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        teamAction.classList.remove('opacity-50', 'cursor-not-allowed');
      }

      // Vote button
      voteAction.classList.remove('hidden');
      const isVoteEnabled = appConfig.allow_vote === true;
      voteAction.disabled = !isVoteEnabled;
      voteAction.title = !isVoteEnabled ? 'Voting is currently disabled' : '';
      if (!isVoteEnabled) {
        voteAction.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        voteAction.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } else {
      voteAction.classList.add('hidden');
      teamAction.classList.add('hidden');
    }

    // Hide action buttons section if no buttons are visible
    if (currentRole === 'AI' || 
        (currentRole !== 'Backdoor' && !appConfig.allow_vote && !appConfig.allow_submit_team)) {
      actionButtons.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error fetching role:', error);
    pinError.classList.remove('hidden');
  } finally {
    button.classList.remove("btn-loading");
    updateButtonState();
  }
}

function renderRoleSpecificData(roleData) {
  if (!roleData) return '';

  switch (roleData.type) {
    case 'team_list':
      return `
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-3">
            <span class="text-yellow-400">&gt;</span> ข้อมูลสำหรับ: ${roleData.role} ${getRoleEmoji(roleData.role)}
          </h4>
          <div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
            <table class="min-w-full">
              <thead>
                <tr>
                  <th class="text-left text-gray-300 pb-2">ชื่อ</th>
                  <th class="text-left text-gray-300 pb-2">บทบาท</th>
                </tr>
              </thead>
              <tbody>
                ${roleData.members.map(member => `
                  <tr class="border-t border-gray-700">
                    <td class="py-2 text-white">${member.name}</td>
                    <td class="py-2 text-gray-200">${member.role} ${getRoleEmoji(member.role)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    default:
      return '';
  }
}

async function handleSpecialAction(actionType) {
  const buttonId = {
    'leak': 'backdoorAction',
    'vote': 'voteAction',
    'team': 'teamAction'
  }[actionType];
  
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  try {
    button.classList.add('btn-loading');
    button.disabled = true;
    
    // Check if action is allowed in configuration
    const actionKey = {
      'leak': 'allow_submit_leak',
      'vote': 'allow_vote',
      'team': 'allow_submit_team'
    }[actionType];

    if (appConfig[actionKey] !== true) {
      alert('This action is currently disabled by configuration.');
      return;
    }
    
    // TODO: Implement special actions when ready
    console.log(`Special action ${actionType} triggered`);
    
  } catch (error) {
    console.error(`Error in special action ${actionType}:`, error);
  } finally {
    button.classList.remove('btn-loading');
    button.disabled = false;
  }
} 