// Get API URL from config
const API_URL = ENV.API_URL;

let currentMode = 'login'; // 'login' or 'setup'
let currentRole = ''; // Store current user's role
let appConfig = {}; // Store application configuration
let currentUser = '';
let currentTeam = '';
let voteModal = null;

// Add cache helper functions at the top
function getCachedData(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const data = JSON.parse(item);
    const now = new Date().getTime();

    if (now > data.expiry) {
      localStorage.removeItem(key);
      return null;
    }

    return data.value;
  } catch (err) {
    console.error('Error reading from cache:', err);
    return null;
  }
}

function setCachedData(key, value, hoursToExpire = 24) {
  try {
    const expiry = new Date().getTime() + (hoursToExpire * 60 * 60 * 1000);
    const item = {
      value: value,
      expiry: expiry
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (err) {
    console.error('Error writing to cache:', err);
  }
}

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

// Add rules popup functions
function showRules() {
  // Create iframe for rules
  const iframe = document.createElement('iframe');
  iframe.src = 'rules.html';
  iframe.className = 'w-full h-full border-0 rounded-lg';
  
  // Create popup container
  const popup = document.createElement('div');
  popup.className = 'fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50 p-4 sm:p-6';
  popup.innerHTML = `
    <div class="bg-gray-800 rounded-lg shadow-xl w-full h-[90vh] sm:h-[95vh] flex flex-col">
      <div class="flex justify-between items-center p-4 border-b border-gray-700">
        <h3 class="text-lg font-medium text-white">กฎการเล่น Operation: Backdoor</h3>
        <button 
          onclick="this.closest('.fixed').remove()" 
          class="text-gray-400 hover:text-white transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-auto p-1">
        ${iframe.outerHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
}

window.onload = async () => {
  const nameInput = document.getElementById("nameInput");
  const loadingText = document.getElementById("loadingText");
  const pinLoginContainer = document.getElementById("pinLoginContainer");
  const pinSetupContainer = document.getElementById("pinSetupContainer");
  const actionButton = document.getElementById("actionButton");
  const newPin = document.getElementById("newPin");
  const confirmPin = document.getElementById("confirmPin");
  const pinInput = document.getElementById("pinInput");
  const autocompleteDropdown = document.getElementById("autocompleteDropdown");
  
  let names = []; // Store all names
  let selectedName = ''; // Store currently selected name

  // Add rules button after title
  const titleElement = document.querySelector('.text-2xl.sm\\:text-3xl');
  if (titleElement) {
    const rulesButton = document.createElement('button');
    rulesButton.className = 'ml-4 px-3 py-1 text-sm bg-gray-800 text-gray-300 hover:text-green-400 rounded-lg border border-gray-700 transition-colors flex items-center gap-2';
    rulesButton.innerHTML = `
      <span>กดเพื่อดูคำอธิบายและกฎการเล่น</span>
      <span class="text-lg">📖</span>
    `;
    rulesButton.onclick = showRules;
    titleElement.parentElement.appendChild(rulesButton);
  }

  // Add input event listeners for PIN fields
  pinInput.addEventListener('input', (e) => {
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

  // Add input event listener for name input
  nameInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    updateButtonState();
    
    // Filter names based on input
    const filteredNames = value 
      ? names.filter(name => name.toLowerCase().includes(value.toLowerCase()))
      : names;
    
    // Show all names if input is empty, otherwise show filtered results
    updateAutocompleteDropdown(filteredNames);
  });

  try {
    // Set initial states
    loadingText.textContent = 'กำลังโหลดรายชื่อผู้ใช้งาน รอแป๊ปปป 🚅';
    loadingText.style.display = 'flex';
    nameInput.style.display = 'none';

    // Load configuration first
    const configRes = await fetch(`${API_URL}?get_config=true`);
    appConfig = await configRes.json();
    
    console.log('Loaded configuration:', appConfig);
    console.log('allow_vote value:', appConfig.allow_vote, 'type:', typeof appConfig.allow_vote);
    
    if (appConfig.error) {
      console.error('Configuration error:', appConfig.error);
    }

    // Try to get cached names first
    const cachedNames = getCachedData('userNames');
    if (cachedNames) {
      names = cachedNames;
      loadingText.style.display = 'none';
      nameInput.style.display = 'block';
      
      // Load saved selection if exists
      const savedName = getCookie('selectedUser');
      if (savedName && names.includes(savedName)) {
        nameInput.value = savedName;
        selectedName = savedName;
        handleNameSelection(savedName);
      }
    } else {
      // Fetch fresh names if no cache
      try {
        const res = await fetch(`${API_URL}?list=true`);
        names = await res.json();
        
        // Cache the names
        setCachedData('userNames', names);
        
        loadingText.style.display = 'none';
        nameInput.style.display = 'block';

        // Load saved selection if exists
        const savedName = getCookie('selectedUser');
        if (savedName && names.includes(savedName)) {
          nameInput.value = savedName;
          selectedName = savedName;
          handleNameSelection(savedName);
        }
      } catch (error) {
        console.error('Error fetching names:', error);
        loadingText.textContent = "ไม่สามารถโหลดรายชื่อได้ กรุณารีเฟรชหน้าเว็บ";
        loadingText.classList.remove('text-gray-500');
        loadingText.classList.add('text-red-500');
      }
    }

    // Add focus handler for showing all options
    nameInput.addEventListener('focus', () => {
      if (!nameInput.value.trim()) {
        updateAutocompleteDropdown(names);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!nameInput.contains(e.target) && !autocompleteDropdown.contains(e.target)) {
        autocompleteDropdown.classList.add('hidden');
      }
    });

  } catch (e) {
    console.error('Error in initialization:', e);
    loadingText.textContent = "ไม่สามารถโหลดรายชื่อได้ กรุณารีเฟรชหน้าเว็บ";
    loadingText.classList.remove('text-gray-500');
    loadingText.classList.add('text-red-500');
  }

  function updateAutocompleteDropdown(filteredNames) {
    if (filteredNames.length === 0) {
      autocompleteDropdown.classList.add('hidden');
      return;
    }

    // Create dropdown items
    autocompleteDropdown.innerHTML = filteredNames
      .map(name => `
        <div 
          class="px-4 py-2 cursor-pointer hover:bg-gray-700 text-green-400 transition-colors"
          data-name="${name}"
        >${name}</div>
      `)
      .join('');

    // Show dropdown
    autocompleteDropdown.classList.remove('hidden');

    // Add click handlers to dropdown items
    autocompleteDropdown.querySelectorAll('div').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        nameInput.value = name;
        selectedName = name;
        autocompleteDropdown.classList.add('hidden');
        handleNameSelection(name);
      });
    });
  }

  async function handleNameSelection(name) {
    if (name) {
      // Save selection to cookie
      setCookie('selectedUser', name);

      // Hide PIN input while checking
      pinLoginContainer.classList.add('hidden');
      pinSetupContainer.classList.add('hidden');
      
      // Show checking indicator
      const checkingSpan = document.createElement('span');
      checkingSpan.className = 'checking-pin';
      checkingSpan.textContent = 'เช็คแปปว่ามี PIN ยัง ใจเย็นๆนะของรีบทำ';
      nameInput.parentElement.appendChild(checkingSpan);

      // Disable input while checking
      nameInput.disabled = true;
      
      try {
        // Check if PIN needs setup
        const checkRes = await fetch(`${API_URL}?check_pin=true&name=${encodeURIComponent(name)}`);
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
        updateButtonState(); // Make sure to update button state after changing mode
      } catch (error) {
        console.error('Error checking PIN:', error);
      } finally {
        // Remove checking indicator and re-enable input
        const checkingSpan = nameInput.parentElement.querySelector('.checking-pin');
        if (checkingSpan) checkingSpan.remove();
        nameInput.disabled = false;
        updateButtonState(); // Update button state again after enabling input
      }
    } else {
      // Clear cookie if no selection
      setCookie('selectedUser', '', -1);
      pinLoginContainer.classList.add('hidden');
      pinSetupContainer.classList.add('hidden');
      updateButtonState(); // Update button state when clearing selection
    }
  }
};

function updateButtonState() {
  const nameInput = document.getElementById("nameInput");
  const actionButton = document.getElementById("actionButton");
  
  if (currentMode === 'login') {
    const pinInput = document.getElementById("pinInput");
    actionButton.disabled = !nameInput.value || pinInput.value.length !== 4;
  } else {
    const newPin = document.getElementById("newPin");
    const confirmPin = document.getElementById("confirmPin");
    actionButton.disabled = !nameInput.value || newPin.value.length !== 4 || confirmPin.value.length !== 4;
  }
}

function resetPinFields() {
  document.getElementById("pinInput").value = '';
  document.getElementById("newPin").value = '';
  document.getElementById("confirmPin").value = '';
  document.getElementById("pinError").classList.add('hidden');
  document.getElementById("pinSetupError").classList.add('hidden');
}

function getRoleEmoji(role, roleIcon) {
  // If roleIcon is provided from API response, use it
  if (roleIcon) return roleIcon;
  
  // If we have icons in config, use those
  if (appConfig.roleIcons && appConfig.roleIcons[role]) {
    return appConfig.roleIcons[role];
  }
  
  // Fallback emojis if no config or API icon available
  const roleEmojis = {
    'AI': '🚀',
    'Backdoor': '🔑',
    'Backdoor Installer': '🦹',
    'Team Member': '🧑‍💻',
    'Staff Engineer': '🤓',
    'Legacy code': '🐛'
  };
  return roleEmojis[role] || '💻'; // Default emoji if role not found
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
  const name = document.getElementById("nameInput").value;
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
  const name = document.getElementById("nameInput").value;
  const pin = document.getElementById("pinInput").value;
  const pinError = document.getElementById("pinError");
  const nameSelectContainer = document.getElementById("nameSelectContainer");
  const instructionText = document.querySelector('.text-gray-400.mb-4');

  if (!name) return alert("กรุณาเลือกชื่อ");
  if (!pin || pin.length !== 4) return alert("กรุณาใส่รหัส PIN 4 หลัก");

  try {
    // Show loading state
    if (button) {
      button.classList.add("btn-loading");
      button.disabled = true;
    }

    // Fetch role with PIN validation
    const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}&pin=${pin}`);
    const text = await res.text();
    const data = JSON.parse(text);

    if (data.error) {
      if (pinError) pinError.classList.remove('hidden');
      return;
    }
    
    // Store current role and user info
    currentRole = data.role;
    currentUser = data.name;
    currentTeam = data.team;

    // Store team members, AI members, and voting info in localStorage
    if (data.teamMembers) {
      const teamMembersList = data.teamMembers.map(name => ({
        id: name,
        name: name
      }));
      localStorage.setItem('currentUserId', currentUser);
      setCachedData('teamMembers', teamMembersList, 24 * 60 * 60 * 1000);
      
      if (data.AI && Array.isArray(data.AI)) {
        setCachedData('aiMembers', data.AI, 24 * 60 * 60 * 1000);
      }

      // Store voting information
      if (data.isVoted) {
        localStorage.setItem('hasVoted', 'true');
      } else {
        localStorage.removeItem('hasVoted');
      }
    }
    
    // Hide name selection, PIN input sections, and instruction text
    if (nameSelectContainer) nameSelectContainer.classList.add('hidden');
    if (button) button.classList.add('hidden');
    if (instructionText) instructionText.classList.add('hidden');
    
    if (pinError) pinError.classList.add('hidden');
    if (result) {
      result.classList.remove('hidden');
      
      // Get team submission status from config
      const isTeamEnabled = Boolean(appConfig.allow_submit_team);
      
      result.innerHTML = `
        <div class="space-y-4">
          <!-- Content Container -->
          <div id="contentContainer" class="pb-16"> <!-- Add padding at bottom for nav bar -->
            <!-- Team Tab Content -->
            <div id="teamContent" class="space-y-4">
              ${data.teamMission ? `
                <div class="mb-6">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-purple-400">&gt;</span>
                    <h3 class="text-lg font-semibold text-white">ภารกิจทีม ${data.team}</h3>
                  </div>
                  <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
                    <p class="text-gray-200 whitespace-pre-line leading-relaxed">ภารกิจทีมคือการให้อย่างน้อยหนึ่งคนในทีมถ่ายรูปตามข้อกำหนดด้านล่าง จากนั้นกดปุ่มส่งรูปเข้ามาในระบบ จะกดส่งมากกว่าหนึ่งคนก็ได้ แต่ว่ายิ่งส่งรูปเยอะมีโอกาสที่จะชนะรางวัลมากขึ้นด้วยนะเอาจริงๆ</p>
                    <div class="border-t border-gray-700 pt-4">
                      <p class="text-gray-200 whitespace-pre-line leading-relaxed">${data.teamMission}</p>
                    </div>
                    <button 
                      onclick="handleSpecialAction('team')" 
                      class="w-full bg-blue-600 text-black font-medium py-2 px-4 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:opacity-75 ${!isTeamEnabled ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75' : ''}"
                      ${!isTeamEnabled ? 'disabled' : ''}
                    >
                      <div class="flex flex-col items-center">
                        <span>$ execute --submit-result --team-${data.team}</span>
                        ${!isTeamEnabled ? '<span class="text-xs opacity-75 mt-1">จะเปิดใช้วันไป outing นะ</span>' : ''}
                      </div>
                    </button>
                  </div>
                </div>

                ${data.teamMembers ? `
                  <div class="mb-6">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="text-purple-400">&gt;</span>
                      <h3 class="text-lg font-semibold text-white">สมาชิกในทีม ${data.team}</h3>
                    </div>
                    <div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
                      <div class="grid grid-cols-2 gap-2">
                        ${data.teamMembers.map(member => `
                          <div class="text-white">${member}</div>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                ` : ''}
              ` : ''}
            </div>

            <!-- Role Tab Content -->
            <div id="roleContent" class="space-y-4 hidden">
              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <div class="font-medium text-gray-200">บทบาท: <span class="text-white">${data.role} ${getRoleEmoji(data.role, data.roleIcon)}</span></div>
                <div class="mt-2 font-medium text-gray-200">ทีม: <span class="text-white">${data.team}</span></div>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-yellow-400 mb-2">📋 คำแนะนำ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.instruction}</p>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-green-400 mb-2">🏆 เงื่อนไขการชนะ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.winCondition}</p>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-blue-400 mb-2">💡 กลยุทธ์แนะนำ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.recommendation}</p>
              </div>

              ${renderRoleSpecificData(data.roleData)}
            </div>
          </div>

          <!-- Bottom Navigation Bar -->
          <div class="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
            <div class="max-w-3xl mx-auto px-4">
              <div class="flex justify-around">
                <button 
                  onclick="switchTab('team')" 
                  class="tab-button active flex-1 py-3 px-4 text-center focus:outline-none group"
                  id="teamTab"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-xl mb-1">👥</span>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">ทีม ${data.team}</span>
                  </div>
                </button>
                <button 
                  onclick="switchTab('role')" 
                  class="tab-button flex-1 py-3 px-4 text-center focus:outline-none group"
                  id="roleTab"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-xl mb-1">🧑‍💻</span>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">บทบาท</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Add tab switching function
      window.switchTab = function(tab) {
        // Update content visibility
        document.getElementById('teamContent').classList.toggle('hidden', tab !== 'team');
        document.getElementById('roleContent').classList.toggle('hidden', tab !== 'role');
        
        // Update tab button styles
        document.getElementById('teamTab').classList.toggle('active', tab === 'team');
        document.getElementById('roleTab').classList.toggle('active', tab === 'role');
      }
    }

    // Show and configure action buttons based on role
    if (actionButtons) {
      actionButtons.classList.remove('hidden');
      
      // Configure Backdoor action button
      if (currentRole === 'Backdoor' && backdoorAction) {
        backdoorAction.classList.remove('hidden');
        const isLeakEnabled = Boolean(appConfig.allow_submit_leak);
        backdoorAction.disabled = !isLeakEnabled;
        backdoorAction.title = !isLeakEnabled ? 'This action is currently disabled' : '';
        if (!isLeakEnabled) {
          backdoorAction.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          backdoorAction.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      } else if (backdoorAction) {
        backdoorAction.classList.add('hidden');
      }

      // Configure vote button
      if (voteAction) {
        const isVoteEnabled = appConfig.allow_vote === 1 || appConfig.allow_vote === true;
        const hasVoted = localStorage.getItem('hasVoted') === 'true';
        
        voteAction.disabled = !isVoteEnabled;
        voteAction.title = !isVoteEnabled ? 'Voting is currently disabled' : '';
        
        voteAction.innerHTML = `
          <div class="flex flex-col items-center">
            <span>$ vote --leak</span>
            ${hasVoted ? 
              '<span class="text-xs opacity-75 mt-1">คุณได้โหวตแล้ว แต่สามารถเปลี่ยนได้</span>' :
              !isVoteEnabled ? 
                '<span class="text-xs opacity-75 mt-1">จะเปิดให้โหวตวัน outing กิจกรรมกลางคืน</span>' : 
                '<span class="text-xs opacity-75 mt-1">จะเปิดให้โหวตวัน outing กิจกรรมกลางคืน</span>'
            }
          </div>
        `;
        
        if (!isVoteEnabled) {
          voteAction.classList.add('bg-gray-700', 'text-gray-400', 'opacity-75', 'cursor-not-allowed');
          voteAction.classList.remove('bg-yellow-600', 'hover:bg-yellow-500');
        } else {
          voteAction.classList.remove('bg-gray-700', 'text-gray-400', 'opacity-75', 'cursor-not-allowed');
          voteAction.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
          
          // Initialize vote modal if not already done
          if (!voteModal) {
            voteModal = new VoteModal();
          }
          
          // Add click handler for vote button
          voteAction.addEventListener('click', () => {
            if (isVoteEnabled) {
              voteModal.open();
            }
          });
        }
      }

      // Hide action buttons section if no visible buttons
      if (currentRole === 'AI') {
        actionButtons.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Error fetching role:', error);
    if (pinError) pinError.classList.remove('hidden');
  } finally {
    if (button) {
      button.classList.remove("btn-loading");
      updateButtonState();
    }
  }
}

function renderRoleSpecificData(roleData) {
  if (!roleData) return '';

  switch (roleData.type) {
    case "team_list":
      return `
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-3">
            <span class="text-yellow-400">&gt;</span> ข้อมูลสำหรับ: ${roleData.role} ${getRoleEmoji(roleData.role, roleData.roleIcon)}
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
                    <td class="py-2 text-gray-200">${member.role} ${getRoleEmoji(member.role, member.roleIcon)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

    case "legacy_mission":
      return `
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-3">
            <span class="text-yellow-400">&gt;</span> Legacy Code Mission ${getRoleEmoji(roleData.role, roleData.roleIcon)}
          </h4>
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            <div class="text-gray-200 whitespace-pre-line leading-relaxed">${roleData.mission}</div>
          </div>
        </div>
      `;

    case "backdoor_mission":
      const isLeakEnabled = Boolean(appConfig.allow_submit_leak);
      return `
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-3">
            <span class="text-red-400">&gt;</span> Backdoor Mission ${getRoleEmoji(roleData.role, roleData.roleIcon)}
          </h4>
          <div class="bg-gray-800/50 rounded-lg border border-red-900/50 p-4 space-y-4">
            <div class="text-gray-200 whitespace-pre-line leading-relaxed">${roleData.mission}</div>
            <button 
              onclick="handleSpecialAction('leak')" 
              class="w-full bg-red-600 text-black font-medium py-2 px-4 rounded-lg hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:opacity-75 ${!isLeakEnabled ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75' : ''}"
              ${!isLeakEnabled ? 'disabled' : ''}
            >
              <div class="flex flex-col items-center">
                <span>$ leak --team-data</span>
                ${!isLeakEnabled ? '<span class="text-xs opacity-75 mt-1">จะเปิดให้ leak ตอนกิจกรรมกลางคืน</span>' : ''}
              </div>
            </button>
          </div>
        </div>
      `;

    case "backdoor_installer":
      return `
        <div class="mt-6">
          <h4 class="text-lg font-semibold text-white mb-3">
            <span class="text-yellow-400">&gt;</span> Backdoor Installer Information ${getRoleEmoji(roleData.role, roleData.roleIcon)}
          </h4>
          <div class="bg-gray-800/50 rounded-lg border border-yellow-900/50 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">Backdoor ในทีมของคุณ</h5>
              <div class="bg-gray-900/50 rounded-lg p-3 border border-yellow-900/30">
                <div class="flex items-center gap-2">
                  <span class="text-red-400">${getRoleEmoji('Backdoor', roleData.backdoorIcon)}</span>
                  <span class="text-white">${roleData.backdoorMember}</span>
                </div>
              </div>

            <!-- Mission Info -->
            <div class="border-t border-yellow-900/30 pt-4">
              <h5 class="text-yellow-400 font-medium mb-2">ภารกิจที่ต้องช่วย Backdoor</h5>
              <div class="text-gray-200 whitespace-pre-line leading-relaxed">${roleData.mission}</div>
            </div>
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
    'team': null
  }[actionType];

  if (actionType === 'vote') {
    // Use the new VoteModal class
    if (voteModal) {
      voteModal.open();
    }
    return;
  }

  if (actionType === 'team') {
    const teamButton = document.querySelector('button[onclick="handleSpecialAction(\'team\')"]');
    const nameInput = document.getElementById("nameInput");
    if (!teamButton || !nameInput) return;
    
    try {
      teamButton.classList.add('btn-loading');
      teamButton.disabled = true;
      
      if (Boolean(appConfig.allow_submit_team) !== true) {
        alert('This action is currently disabled by configuration.');
        return;
      }

      // Create file input
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      // Trigger file selection
      fileInput.click();

      // Handle file selection
      fileInput.onchange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) {
          document.body.removeChild(fileInput);
          return;
        }

        // Get the team button and create loading overlay
        const teamButton = document.querySelector('button[onclick="handleSpecialAction(\'team\')"]');
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50';
        loadingOverlay.innerHTML = `
          <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-sm w-full mx-4">
            <div class="flex items-center gap-3 text-green-400">
              <div class="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"></div>
              <div class="text-sm">
                <div>กำลังอัพโหลดรูปภาพ...</div>
                <div class="text-xs text-gray-400 mt-1">รอแปปนะครับ/คะ ขนาดไฟล์ใหญ่อาจจะช้าหน่อย</div>
              </div>
            </div>
          </div>
        `;

        try {
          // Show loading overlay
          document.body.appendChild(loadingOverlay);
          teamButton.disabled = true;

          // Read file as base64
          const reader = new FileReader();
          
          // Create a promise to handle file reading
          const readFileAsBase64 = new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(selectedFile);
          });

          // Wait for file to be read
          const base64Result = await readFileAsBase64;
          // Get base64 data (remove data:image/xyz;base64, prefix)
          const base64Data = base64Result.split(',')[1];
          
          // Create form data
          const formData = new FormData();
          formData.append('team', currentTeam);
          formData.append('name', nameInput.value);
          formData.append('file', base64Data);
          formData.append('filename', selectedFile.name);
          formData.append('mimeType', selectedFile.type);

          // Update loading message
          loadingOverlay.querySelector('.text-sm').innerHTML = `
            <div>กำลัง Upload File...</div>
            <div class="text-xs text-gray-400 mt-1">ขโมยรูปไปลง Google Drive ไว้ส่งลิ้งให้นะ 💽</div>
          `;

          // Upload file directly to API endpoint
          const uploadRes = await fetch(API_URL, {
            method: 'POST',
            body: formData
          });

          const result = await uploadRes.json();

          if (result.success) {
            // Update loading overlay with success message
            loadingOverlay.innerHTML = `
              <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-sm w-full mx-4">
                <div class="flex items-center gap-3 text-green-400">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <div class="text-sm">
                    <div>อัพโหลดสำเร็จ!</div>
                    <div class="text-xs text-gray-400 mt-1">เก่งมากครับ เอาอีกเยอะๆได้นะ กดส่งมารัวๆได้เลย 📸📸</div>
                  </div>
                </div>
              </div>
            `;
            // Remove success message after 3 seconds
            setTimeout(() => {
              document.body.removeChild(loadingOverlay);
            }, 3000);
          } else {
            throw new Error(result.error || 'Failed to upload image');
          }
        } catch (error) {
          console.error('Upload error:', error);
          // Update loading overlay with error message
          loadingOverlay.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-sm w-full mx-4">
              <div class="flex items-center gap-3 text-red-400">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                <div class="text-sm">
                  <div>เกิดข้อผิดพลาด มีอะไรพังแหละ ไว้ลองกดใหม่นะ ไม่น่าจะแก้อะไรแล้ว😵</div>
                  <div class="text-xs text-gray-400 mt-1">${error.message}</div>
                </div>
              </div>
            </div>
          `;
          // Remove error message after 3 seconds
          setTimeout(() => {
            document.body.removeChild(loadingOverlay);
          }, 3000);
        } finally {
          document.body.removeChild(fileInput);
          teamButton.disabled = false;
        }
      };

      // Handle cancel
      fileInput.oncancel = () => {
        document.body.removeChild(fileInput);
      };
      
    } catch (error) {
      console.error('Error in team submission:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      teamButton.classList.remove('btn-loading');
      teamButton.disabled = Boolean(appConfig.allow_submit_team) !== true;
    }
    return;
  }
  
  // Handle other actions (leak and vote)
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  try {
    button.classList.add('btn-loading');
    button.disabled = true;
    
    // Check if action is allowed in configuration
    const actionKey = {
      'leak': 'allow_submit_leak',
      'vote': 'allow_vote'
    }[actionType];

    if (Boolean(appConfig[actionKey]) !== true) {
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

async function submitLeak(button) {
  const dialog = button.closest('.fixed');
  const textarea = dialog.querySelector('textarea');
  const content = textarea.value.trim();
  
  if (!content) {
    alert('Please enter the information you want to leak');
    return;
  }
  
  try {
    // Show loading state
    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>Submitting...</span>
      </div>
    `;
    
    // Create form data
    const formData = new FormData();
    formData.append('leak_submission', 'true');
    formData.append('name', currentUser);
    formData.append('team', currentTeam);
    formData.append('content', content);
    
    // Submit leak
    const res = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const result = await res.json();
    
    if (result.success) {
      // Show success message
      dialog.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-sm w-full mx-4">
          <div class="flex items-center gap-3 text-green-400">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <div class="text-sm">
              <div>Leak submitted successfully!</div>
              <div class="text-xs text-gray-400 mt-1">Your information has been recorded.</div>
            </div>
          </div>
        </div>
      `;
      
      // Remove dialog after delay
      setTimeout(() => {
        dialog.remove();
      }, 2000);
    } else {
      throw new Error(result.error || 'Failed to submit leak');
    }
  } catch (error) {
    console.error('Error submitting leak:', error);
    
    // Show error message
    button.innerHTML = originalText;
    button.disabled = false;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-red-400 text-sm mt-2';
    errorDiv.textContent = error.message;
    button.parentElement.appendChild(errorDiv);
  }
}

// Add after the cache helper functions
async function refreshNamesList() {
  try {
    // Clear existing cache
    localStorage.removeItem('userNames');
    
    // Fetch fresh data
    const res = await fetch(`${API_URL}?list=true`);
    const freshNames = await res.json();
    
    // Cache new data
    setCachedData('userNames', freshNames);
    
    return freshNames;
  } catch (error) {
    console.error('Error refreshing names list:', error);
    throw error;
  }
}

// Add after the cache helper functions
async function clearCache() {
  try {
    // Create feedback toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-gray-800 text-green-400 px-4 py-2 rounded-lg border border-gray-700 shadow-lg z-50 flex items-center gap-2 transition-opacity duration-300';
    toast.innerHTML = `
      <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
      </svg>
      <span>ลบแคชอยู่แปปนะ...</span>
    `;
    document.body.appendChild(toast);

    // Clear localStorage
    localStorage.clear();
    
    // Show success message
    toast.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>ลบเสร็จแล้ว reload แว๊บเดียว</span>
    `;
    toast.classList.remove('bg-gray-800');
    toast.classList.add('bg-green-900');

    // Wait a moment to show the success message, then refresh
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('Error clearing cache:', error);
    
    // Show error message
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-900 text-red-400 px-4 py-2 rounded-lg border border-red-700 shadow-lg z-50 flex items-center gap-2';
    toast.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
      <span>Failed to clear cache</span>
    `;
    document.body.appendChild(toast);

    // Remove error toast after delay
    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
} 