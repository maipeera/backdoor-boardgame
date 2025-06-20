// Get API URL from config
const API_URL = ENV.API_URL;

/**
 * Makes an API request to the backend
 * @param {Object} params - Query parameters for the API request
 * @returns {Promise<any>} The JSON response from the API
 */
async function apiRequest(params = {}) {
  try {
    // Convert params object to URL search params
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });

    const url = `${API_URL}?${searchParams.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

let currentMode = 'login'; // 'login' or 'setup'
let currentRole = ''; // Store current user's role
let appConfig = {}; // Store application configuration
let currentUser = '';
let currentTeam = '';
let voteModal = null;

// Helper function to convert 1/0 to boolean
function toBool(value) {
  return value === 1;
}

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
function setCookie(name, value, hours = 24) {
  try {
    // Convert hours to seconds for max-age
    const maxAge = hours * 60 * 60;
    // Add SameSite attribute and make sure cookie works in most contexts
    const cookie = `${name}=${value};max-age=${maxAge};path=/;SameSite=Lax`;
    document.cookie = cookie;
    
    // Verify cookie was set
    const savedValue = getCookie(name);
    console.log('Setting cookie:', {
      name,
      value,
      maxAge,
      cookie,
      'Saved successfully': savedValue === value
    });
    
    return savedValue === value;
  } catch (err) {
    console.error('Error setting cookie:', err);
    return false;
  }
}

function getCookie(name) {
  try {
    const value = `; ${document.cookie}`;
    console.log('All cookies:', document.cookie);
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop().split(';').shift();
      console.log('Found cookie:', { name, value: cookieValue });
      return cookieValue;
    }
    console.log('Cookie not found:', name);
    return '';
  } catch (err) {
    console.error('Error getting cookie:', err);
    return '';
  }
}

// Add clear cookie functions
function clearCookie(name) {
  try {
    // Set max-age to 0 to immediately expire the cookie
    document.cookie = `${name}=;max-age=0;path=/;SameSite=Lax`;
    
    // Verify cookie was cleared
    const cleared = !getCookie(name);
    console.log('Clearing cookie:', { name, 'Cleared successfully': cleared });
    
    return cleared;
  } catch (err) {
    console.error('Error clearing cookie:', err);
    return false;
  }
}

function clearAllCookies() {
  try {
    // Get all cookies
    const cookies = document.cookie.split(';');
    console.log('Clearing all cookies:', cookies);
    
    // Clear each cookie
    let allCleared = true;
    for (let cookie of cookies) {
      const name = cookie.split('=')[0].trim();
      const cleared = clearCookie(name);
      if (!cleared) allCleared = false;
    }
    
    console.log('All cookies cleared:', allCleared);
    return allCleared;
  } catch (err) {
    console.error('Error clearing all cookies:', err);
    return false;
  }
}

// Add user credential caching functions using cookies
function cacheUserCredentials(name, pin) {
  try {
    const credentials = { name, pin };
    console.log('Attempting to cache credentials for:', name);
    
    // Cache in cookie
    const cookieSuccess = setCookie('cachedUser', JSON.stringify(credentials), 1); // Cache for 1 hour
    
    // Cache in localStorage
    setCachedData('cachedUser', credentials, 1); // Cache for 1 hour
    
    // Log results
    if (cookieSuccess) {
      console.log('Successfully cached user credentials in cookie');
    } else {
      console.warn('Failed to cache user credentials in cookie');
    }
    
    // Verify the credentials were cached
    const cached = getCachedUserCredentials();
    console.log('Verification - Cached credentials:', cached);
    
    return cookieSuccess;
  } catch (err) {
    console.error('Error caching credentials:', err);
    return false;
  }
}

function getCachedUserCredentials() {
  try {
    // First try to get credentials from cookie
    const cookieCredentials = getCookie('cachedUser');
    if (cookieCredentials) {
      const parsed = JSON.parse(cookieCredentials);
      console.log('Retrieved cached credentials from cookie for:', parsed.name);
      return parsed;
    }
    
    // If no cookie found, try localStorage
    const localStorageCredentials = getCachedData('cachedUser');
    if (localStorageCredentials) {
      console.log('Retrieved cached credentials from localStorage for:', localStorageCredentials.name);
      return localStorageCredentials;
    }
    
    console.log('No cached credentials found in cookie or localStorage');
    return null;
  } catch (err) {
    console.error('Error parsing cached credentials:', err);
    return null;
  }
}

function clearUserCredentials() {
  console.log('Clearing user credentials from cookie and localStorage');
  localStorage.removeItem('cachedUser'); // Clear from localStorage
  return clearCookie('cachedUser'); // Clear from cookie
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
  // Always fetch config first
  appConfig = await apiRequest({ get_config: true });
  console.log('Loaded configuration:', appConfig);
  console.log('allow_vote value:', appConfig.allow_vote, 'type:', typeof appConfig.allow_vote);
  if (appConfig.error) {
    console.error('Configuration error:', appConfig.error);
  }

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

  // Check for cached credentials first
  const cachedCredentials = getCachedUserCredentials();
  if (cachedCredentials) {
    console.log('Found cached credentials, attempting auto-login...');
    // Set the name input value
    nameInput.value = cachedCredentials.name;
    selectedName = cachedCredentials.name;
    
    // Hide name selection initially
    nameInput.style.display = 'none';
    loadingText.style.display = 'flex';
    loadingText.textContent = 'กำลังเข้าสู่ระบบอัตโนมัติ...';

    try {
      // Set pin input value before calling fetchRole
      pinInput.value = cachedCredentials.pin;
      // Call fetchRole directly with the cached credentials
      await fetchRole();
      return; // Exit early as we're already logged in
    } catch (error) {
      console.error('Error during auto-login:', error);
      clearUserCredentials();
      // Reset UI state
      nameInput.style.display = 'block';
      loadingText.style.display = 'none';
      pinInput.value = '';
    }
  } else {
    console.log('No cached credentials found, proceeding with manual login');
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
        names = await apiRequest({ list: true });
        
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
      
      // Cache the name
      setCachedData('name', name);
      
      try {
        // Check if PIN needs setup
        const data = await apiRequest({
          check_pin: true,
          name: name
        });

        if (data.needs_setup) {
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

    const data = await apiRequest({
      setup_pin: true,
      name: name,
      pin: newPin
    });

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
    const data = await apiRequest({
      name: name,
      pin: pin
    });

    if (data.error) {
      if (pinError) pinError.classList.remove('hidden');
      return;
    }
    
    // Cache user credentials and other data
    cacheUserCredentials(name, pin);
    setCachedData('currentUserId', currentUser);
    
    // Store current role and user info
    currentRole = data.roleData.name;
    currentUser = name;
    currentTeam = data.team.name;

    // Store team members and AI members in cache
    if (data.team.members) {
      const teamMembersList = data.team.members.map(name => ({
        id: name,
        name: name
      }));
      setCachedData('teamMembers', teamMembersList);
      
      if (data.team.ai && Array.isArray(data.team.ai)) {
        setCachedData('aiMembers', data.team.ai);
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
      const allowSubmitTeamMissionFlag = Boolean(appConfig.allow_submit_team);
      
      result.innerHTML = `
        <div class="space-y-4">
          <!-- Content Container -->
          <div id="contentContainer" class="pb-24"> <!-- Increased padding at bottom for nav bar -->
            <!-- Team Tab Content -->
            <div id="teamContent" class="space-y-4">
              ${updateTeamMissionHTML(data)}
            </div>

            <!-- Role Tab Content -->
            <div id="roleContent" class="space-y-4 hidden">
              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <div class="font-medium text-gray-200">บทบาท: <span class="text-white">${data.roleData.name} ${getRoleEmoji(data.roleData.name, data.roleData.icon)}</span></div>
                <div class="mt-2 font-medium text-gray-200">ทีม: <span class="text-white">${data.team.name}</span></div>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-yellow-400 mb-2">📋 คำแนะนำ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.roleData.instruction}</p>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-green-400 mb-2">🏆 เงื่อนไขการชนะ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.roleData.win_condition}</p>
              </div>

              <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <h3 class="text-lg font-medium text-blue-400 mb-2">💡 กลยุทธ์แนะนำ</h3>
                <p class="text-gray-100 whitespace-pre-line leading-relaxed">${data.roleData.recommendation}</p>
              </div>

              ${renderRoleSpecificData(data.roleData)}
            </div>

            <!-- Voting Tab Content -->
            <div id="votingContent" class="space-y-4 hidden">
              <div class="max-w-4xl mx-auto">
                ${appConfig.voting_warning_msg ? `
                  <div class="mb-4">
                    <div class="bg-yellow-900/20 rounded-lg border border-yellow-700/50 p-4">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-xl">⚠️</span>
                        <h3 class="text-lg font-semibold text-yellow-400">คำเตือน</h3>
                      </div>
                      <p class="text-gray-300 whitespace-pre-line leading-relaxed">${appConfig.voting_warning_msg}</p>
                    </div>
                  </div>
                ` : ''}
                ${currentUser ? `
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                      <h2 class="text-lg font-bold text-white">🗳️ จับโจรกันจ้า</h2>
                      <span id="votingRoundInfo" class="text-sm font-medium ml-4"></span>
                    </div>
                    <button 
                      onclick="refreshVotingData()" 
                      class="flex items-center gap-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-600"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                      </svg>
                      <span class="text-sm">Refresh</span>
                    </button>
                  </div>
                  <div id="votingRoundsOuterContainer">
                    ${generateVotingInterfaceOuterHTML(data)}
                  </div>
                ` : `
                  <!-- Placeholder View -->
                  <div class="text-center py-12">
                    <div class="text-gray-400 mb-4">🔒 กรุณาเข้าสู่ระบบ</div>
                    <p class="text-gray-500">กรุณาเข้าสู่ระบบเพื่อโหวตเกม</p>
                  </div>
                `}
              </div>
            </div>
          </div>

          <!-- Bottom Navigation Bar -->
          <div class="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
            <div class="max-w-3xl mx-auto px-4">
              <div class="flex justify-around">
                <button 
                  onclick="switchTab('team')" 
                  class="tab-button active flex-1 py-2 px-3 text-center focus:outline-none group"
                  id="teamTab"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-xl mb-1">📷</span>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">ทีม ${data.team.name}</span>
                  </div>
                </button>
                <button 
                  onclick="switchTab('role')" 
                  class="tab-button flex-1 py-3 px-4 text-center focus:outline-none group"
                  id="roleTab"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-xl mb-1">🪪</span>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">บทบาท</span>
                  </div>
                </button>
                <button 
                  onclick="switchTab('voting')" 
                  class="tab-button flex-1 py-3 px-4 text-center focus:outline-none group"
                  id="votingTab"
                >
                  <div class="flex flex-col items-center">
                    <span class="text-xl mb-1">🗳️</span>
                    <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">จับโจร</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Update window.switchTab to be async and include vote result fetching
      window.switchTab = async function(tab) {
        // Update content visibility
        document.getElementById('teamContent').classList.toggle('hidden', tab !== 'team');
        document.getElementById('roleContent').classList.toggle('hidden', tab !== 'role');
        document.getElementById('votingContent').classList.toggle('hidden', tab !== 'voting');
        
        // Update tab button styles
        document.getElementById('teamTab').classList.toggle('active', tab === 'team');
        document.getElementById('roleTab').classList.toggle('active', tab === 'role');
        document.getElementById('votingTab').classList.toggle('active', tab === 'voting');

        // Load vote results when switching to voting tab
        if (tab === 'voting' && currentUser && currentTeam) {
          updateVoteResultsDisplay(null); // Show loading state
          const results = await fetchVoteResults();
          updateVoteResultsDisplay(results);
        }
      }
    }

  } catch (error) {
    console.error('Error fetching role:', error);
  }
}

function renderRoleSpecificData(roleData) {
  if (!roleData || !roleData.specialData) return '';

  // Common warning header for sensitive data
  const warningHeader = `
    <div class="bg-red-900/30 rounded-lg border border-red-700/50 p-4 mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xl">🔒</span>
        <h3 class="text-lg font-semibold text-red-400">ข้อมูลลับเฉพาะคุณ</h3>
      </div>
      <p class="text-gray-300 text-sm">
        ข้อมูลในส่วนนี้เป็นความลับสำหรับบทบาทของคุณเท่านั้น กรุณาอย่าแชร์หรือเปิดเผยให้ผู้อื่นเห็นหน้าจอในส่วนนี้
      </p>
    </div>
  `;

  const { type, ...data } = roleData.specialData;

  // Create reusable role header
  const getRoleHeader = (roleName) => `
    <h4 class="text-lg font-semibold text-white mb-3">
      <span class="text-yellow-400">&gt;</span> ข้อมูลลับ ${roleName} ${getRoleEmoji(roleName, roleData.roleIcon)}
    </h4>
  `;

  switch (type) {
    case "backdoor_mission":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Backdoor')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            ${data.installerMember ? `
              <h5 class="text-yellow-400 font-medium mb-2">Installer ในทีมของคุณ</h5>
              <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                <div class="flex items-center gap-2">
                  <span class="text-yellow-400">${getRoleEmoji('Backdoor Installer', roleData.roleIcon)}</span>
                  <span class="text-white">${data.installerMember}</span>
                </div>
              </div>
            ` : ''}

            <div class="${data.installerMember ? 'border-t border-gray-700/30 pt-4' : ''}">
              <h5 class="text-yellow-400 font-medium mb-2">ภารกิจของคุณ</h5>
              <div class="text-gray-200 whitespace-pre-line leading-relaxed">${data.mission}</div>
            </div>
          </div>
        </div>
      `;

    case "installer_mission":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Backdoor Installer')}
          <div class="bg-gray-800/50 rounded-lg border border-yellow-900/50 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">Backdoor ในทีมของคุณ</h5>
            <div class="bg-gray-900/50 rounded-lg p-3 border border-yellow-900/30">
              <div class="flex items-center gap-2">
                <span class="text-red-400">${getRoleEmoji('Backdoor', roleData.roleIcon)}</span>
                <span class="text-white">${data.backdoorMember}</span>
              </div>
            </div>

            <div class="border-t border-yellow-900/30 pt-4">
              <h5 class="text-yellow-400 font-medium mb-2">ภารกิจที่ต้องช่วย Backdoor</h5>
              <div class="text-gray-200 whitespace-pre-line leading-relaxed">${data.mission}</div>
            </div>
          </div>
        </div>
      `;

    case "legacy_mission":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Legacy Code')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">พฤติกรรมที่ต้องทำในรอบนี้</h5>
            <div class="text-gray-200 whitespace-pre-line leading-relaxed">${data.mission}</div>
          </div>
        </div>
      `;

    case "se_suspects":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Staff Engineer')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
            <h5 class="text-yellow-400 font-medium mb-2">รายชื่อผู้ต้องสงสัย</h5>
            <p class="text-gray-300 mb-4">
              เพราะเก่งแล้วเลยรู้เยอะ มีชื่อคนน่าสงสัย 4 คน คนนึงในนี้จะเป็น Backdoor อีกคนจะเป็น Legacy Code ที่เหลือเป็นใครไม่รู้ เดาเอานะ สู้ๆ
            </p>
            <div class="space-y-2">
              ${data.suspects.map((suspect, index) => `
                <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                  <div class="flex items-center gap-3">
                    <span class="text-gray-400 font-mono">#${index + 1}</span>
                    <span class="text-white">${suspect}</span>
                  </div>
                </div>
              `).join('')}
            </div>
            ${data.keyMember ? `
              <div class="mt-4 pt-4 border-t border-gray-700">
                <h5 class="text-yellow-400 font-medium mb-2">Key ในทีมของคุณ</h5>
                <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                  <div class="flex items-center gap-3">
                    <span class="text-yellow-400">${getRoleEmoji('Key')}</span>
                    <span class="text-white">${data.keyMember}</span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;

    case "key_behavior":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Key')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">พฤติกรรมที่ต้องทำในรอบนี้</h5>
            <div class="text-gray-200 whitespace-pre-line leading-relaxed">${data.behavior}</div>
          </div>
        </div>
      `;
    case "member_hint":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('Team Member')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">คำแนะนำจากทีมของคุณ</h5>
            <div class="text-gray-200 whitespace-pre-line leading-relaxed">${data.hint}</div>
            ${data.keyMember ? `
              <div class="mt-4 pt-4 border-t border-gray-700">
                <h5 class="text-yellow-400 font-medium mb-2">Key ในทีมของคุณ</h5>
                <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                  <div class="flex items-center gap-3">
                    <span class="text-yellow-400">${getRoleEmoji('Key')}</span>
                    <span class="text-white">${data.keyMember}</span>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    case "em_team_info":
      return `
        ${warningHeader}
        <div class="mt-6">
          ${getRoleHeader('AI')}
          <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
            <h5 class="text-yellow-400 font-medium mb-2">สมาชิกในทีมของคุณ</h5>
            <div class="space-y-2">
              ${[...data.teamMembers]
                .sort((a, b) => a.roleId - b.roleId)
                .map(member => `
                  <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="text-gray-400">${member.icon}</span>
                        <span class="text-white">${member.name}</span>
                      </div>
                      <span class="text-gray-400">${member.role}</span>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>
        </div>
      `;

    default:
      return '';
  }
}

// Add gallery view functionality
async function showGallery(teamName) {
  try {
    // Create gallery modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 class="text-lg font-medium text-white">Team ${teamName} Gallery</h3>
          <button 
            onclick="this.closest('.fixed').remove()" 
            class="text-gray-400 hover:text-white transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          <div id="galleryLoading" class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p class="text-gray-400 mt-2">กำลังโหลดรูปภาพ...</p>
          </div>
          <div id="galleryGrid" class="hidden grid grid-cols-2 md:grid-cols-3 gap-4">
            <!-- Images will be populated here -->
          </div>
          <div id="galleryEmpty" class="hidden text-center py-8">
            <p class="text-gray-400">ยังไม่มีรูปภาพที่ส่งเข้ามา</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);

    // Fetch gallery data
    const data = await apiRequest({
      gallery: true,
      team: teamName
    });

    const loadingEl = document.getElementById('galleryLoading');
    const gridEl = document.getElementById('galleryGrid');
    const emptyEl = document.getElementById('galleryEmpty');

    if (data && data.images && data.images.length > 0) {
      // Create image grid
      gridEl.innerHTML = data.images.map(img => {
        // Create download URL by replacing export=view with export=download
        const downloadUrl = img.url.replace('export=view', 'export=download');
        
        return `
          <div class="relative group">
            <img 
              src="${img.thumbnailUrl}" 
              alt="Team submission" 
              class="w-full h-48 object-cover rounded-lg cursor-pointer transition-transform duration-200 group-hover:scale-[1.02]"
              onclick="showFullImage('${img.thumbnailUrl}', '${img.url}', '${img.submitter}')"
            />
            <!-- Download button overlay -->
            <a 
              href="${downloadUrl}" 
              download
              class="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/75 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
              onclick="event.stopPropagation();"
              title="Download image"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
            </a>
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-2 rounded-b-lg">
              <p class="text-white text-sm">Submitted by: ${img.submitter}</p>
              <p class="text-gray-300 text-xs">${new Date(img.timestamp).toLocaleString()}</p>
            </div>
          </div>
        `;
      }).join('');
      
      gridEl.classList.remove('hidden');
      loadingEl.classList.add('hidden');
    } else {
      emptyEl.classList.remove('hidden');
      loadingEl.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading gallery:', error);
    const loadingEl = document.getElementById('galleryLoading');
    if (loadingEl) {
      loadingEl.innerHTML = `
        <svg class="w-8 h-8 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <p class="text-red-500 mt-2">เกิดข้อผิดพลาดในการโหลดรูปภาพ</p>
      `;
    }
  }
}

// Function to show full-size image
function showFullImage(thumbnailUrl, fullUrl, submitter) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-gray-900/90 flex items-center justify-center z-50 p-4';
  
  // Create the modal content with loading state
  modal.innerHTML = `
    <div class="relative max-w-5xl w-full">
      <button 
        onclick="this.closest('.fixed').remove()" 
        class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-20"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      
      <div class="relative">
        <!-- Thumbnail image (shown immediately) -->
        <img 
          src="${thumbnailUrl}" 
          alt="Loading submission by ${submitter}" 
          class="w-full h-auto rounded-lg shadow-xl transition-opacity duration-300"
          style="filter: blur(2px);"
        />
        
        <!-- Loading spinner overlay -->
        <div class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg loading-overlay">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
        
        <!-- Full size image (loaded in background) -->
        <img 
          src="${fullUrl}" 
          alt="Full size submission by ${submitter}" 
          class="w-full h-auto rounded-lg shadow-xl absolute top-0 left-0 opacity-0 transition-opacity duration-300"
          onload="this.classList.add('opacity-100'); this.classList.remove('absolute'); this.previousElementSibling.previousElementSibling.remove(); this.previousElementSibling.remove();"
          onerror="this.previousElementSibling.previousElementSibling.style.filter = 'none'; this.previousElementSibling.innerHTML = '<div class=\'text-red-500 text-center\'><svg class=\'w-8 h-8 mx-auto mb-2\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z\'></path></svg>Failed to load full image</div>'; this.remove();"
        />
      </div>
      <p class="text-white text-center mt-4">Submitted by: ${submitter}</p>
    </div>
  `;
  document.body.appendChild(modal);
}

// Update the team mission section in the original HTML to include the gallery button
function updateTeamMissionHTML(data) {
  return `
    ${data.team.mission ? `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-purple-400">&gt;</span>
          <h3 class="text-lg font-semibold text-white">ภารกิจทีม ${data.team.name}</h3>
        </div>
        <div class="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
          <p class="text-gray-200 whitespace-pre-line leading-relaxed">${appConfig.team_intro}</p>
          ${appConfig.warning_msg ? `
            <div class="border-t border-gray-700 pt-4 mb-4">
              <div class="bg-yellow-900/20 rounded-lg border border-yellow-700/50 p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xl">⚠️</span>
                  <h3 class="text-lg font-semibold text-yellow-400">คำเตือน</h3>
                </div>
                <p class="text-gray-300 whitespace-pre-line leading-relaxed">${appConfig.warning_msg}</p>
              </div>
            </div>
          ` : ''}
          <div class="border-t border-gray-700 pt-4">
            <p class="text-gray-200 whitespace-pre-line leading-relaxed">${data.team.mission}</p>
          </div>
          <div class="space-y-2">
            <button 
              onclick="handleSpecialAction('team')" 
              class="w-full bg-blue-600 text-black font-medium py-2 px-4 rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:opacity-75 ${!toBool(appConfig.allow_submit_team) ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-75' : ''}"
              ${!toBool(appConfig.allow_submit_team) ? 'disabled' : ''}
            >
              <div class="flex flex-col items-center">
                <span>$ execute --submit-result --team-${data.team.name}</span>
                ${!toBool(appConfig.allow_submit_team) ? '<span class="text-xs opacity-75 mt-1">จะเปิดใช้วันไป outing นะ</span>' : ''}
              </div>
            </button>
            
            <button 
              onclick="showGallery('${data.team.name}')" 
              class="w-full bg-purple-600 text-black font-medium py-2 px-4 rounded-lg hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
            >
              <div class="flex flex-col items-center">
                <span>$ view --team-gallery</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    ${data.team.members ? `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-purple-400">&gt;</span>
          <h3 class="text-lg font-semibold text-white">สมาชิกในทีม ${data.team.name}</h3>
        </div>
        <div class="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div class="grid grid-cols-2 gap-2">
            ${data.team.members.map(member => `
              <div class="text-white">${member}</div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
  `;
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
      
      if (!toBool(appConfig.allow_submit_team)) {
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
                <div>กำลังประมวลผลรูปภาพ...</div>
                <div class="text-xs text-gray-400 mt-1">รอแปปนะครับ/คะ กำลังย่อรูปให้เหมาะสม</div>
              </div>
            </div>
          </div>
        `;

        try {
          // Show loading overlay
          document.body.appendChild(loadingOverlay);
          teamButton.disabled = true;

          // Log original file info
          const originalSize = (selectedFile.size / 1024 / 1024).toFixed(2);
          console.log(`Original file: ${selectedFile.name}`);
          console.log(`Original size: ${originalSize} MB`);
          console.log(`Original type: ${selectedFile.type}`);

          // Optimize image
          const optimizedBlob = await optimizeImage(selectedFile);
          
          // Convert optimized blob to base64
          const reader = new FileReader();
          const base64Result = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(optimizedBlob);
          });

          // Get base64 data (remove data:image/xyz;base64, prefix)
          const base64Data = base64Result.split(',')[1];

          // Log optimized size
          const optimizedSize = (optimizedBlob.size / 1024 / 1024).toFixed(2);
          const reduction = (100 - (optimizedBlob.size / selectedFile.size * 100)).toFixed(1);
          console.log(`Optimized size: ${optimizedSize} MB (${reduction}% reduction)`);
          
          // Create form data
          const formData = new FormData();
          // Get cached credentials
          const cachedCredentials = getCachedUserCredentials();
          if (!cachedCredentials) {
            throw new Error('No cached credentials found. Please login again.');
          }
          formData.append('team', currentTeam);
          formData.append('name', cachedCredentials.name);
          formData.append('file', base64Data);
          formData.append('filename', selectedFile.name.replace(/\.[^/.]+$/, "") + ".jpg"); // Force .jpg extension
          formData.append('mimeType', 'image/jpeg');

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
      teamButton.disabled = !toBool(appConfig.allow_submit_team);
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

    if (!toBool(appConfig[actionKey])) {
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
    
    // Submit leak
    const result = await apiRequest({
      leak_submission: true,
      name: currentUser,
      team: currentTeam,
      content: content
    });
    
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
    setCachedData('userNames', null);
    
    // Fetch fresh data
    const freshNames = await apiRequest({ list: true });
    
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
    clearAllCookies();
    
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

// Add refresh config function
async function refreshConfig() {
  console.log('Starting config refresh...');
  
  // Get the refresh button
  const button = document.querySelector('button[onclick="refreshConfig()"]');
  console.log('Refresh button found:', button);
  
  if (button) {
    const text = button.querySelector('.text');
    const spinner = button.querySelector('.spinner');
    
    // Show loading state
    text.classList.add('hidden');
    spinner.classList.remove('hidden');
    button.disabled = true;
  }

  try {
    const data = await apiRequest({ get_config: true });
    console.log('Config data received:', data);

  } catch (error) {
    console.error('Error refreshing config:', error);
    alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  } finally {
    // Reset button state
    if (button) {
      const text = button.querySelector('.text');
      const spinner = button.querySelector('.spinner');
      
      text.classList.remove('hidden');
      spinner.classList.add('hidden');
      button.disabled = false;
    }
  }
}

// Function to fetch vote results
async function fetchVoteResults() {
  try {
    const data = await apiRequest({
      voteResult: true,
      team: currentTeam
    });
    console.log('Voting results received:', data);
    return data;
  } catch (error) {
    console.error('Error fetching vote results:', error);
    return null;
  }
}

// Function to refresh voting data
async function refreshVotingData() {
  try {
    // Get the refresh button
    const button = document.querySelector('button[onclick="refreshVotingData()"]');
    if (button) {
      // Disable button and show loading state
      button.disabled = true;
      const originalContent = button.innerHTML;
      button.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span class="text-sm">Refreshing</span>
      `;

      // Get cached credentials for re-fetching role data
      const cachedCredentials = getCachedUserCredentials();
      if (!cachedCredentials) {
        throw new Error('No cached credentials found. Please login again.');
      }

      // Show loading state
      showVotingRoundsLoading();

      // Refresh config first
      appConfig = await apiRequest({ get_config: true });
      console.log('Manual refresh config complete');
      
      if (appConfig.active_voting_round !== -1) {
        console.log('Voting round is active');
        console.log('Refreshing voting data...');
        // Re-fetch role data to get updated voting interface
        const data = await apiRequest({
          name: cachedCredentials.name,
          pin: cachedCredentials.pin
        });

        // Update voting rounds with new data
        updateVotingRounds(data);
      
        // Then refresh voting results
        updateVoteResultsDisplay(null); // Show loading state
        const results = await fetchVoteResults();
        updateVoteResultsDisplay(results);
      } else {
        updateVotingRounds(null);
      }
      

      // Show success state briefly
      button.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm">Refreshed!</span>
      `;
      
      // Reset button after delay
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
      }, 1000);
    }
  } catch (error) {
    console.error('Error refreshing voting data:', error);
    if (button) {
      button.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>Error!</span>
      `;
      button.disabled = false;
      
      // Reset button after delay
      setTimeout(() => {
        button.innerHTML = originalContent;
      }, 2000);
    }
    alert('เกิดข้อผิดพลาดในการรีเฟรชข้อมูล: ' + error.message);
  }
}

// Function to update vote results display
function updateVoteResultsDisplay(results) {
  const loadingElement = document.getElementById('voteResultsLoading');
  const contentElement = document.getElementById('voteResultsContent');
  const listElement = document.getElementById('voteResultsList');

  if (!results) {
    loadingElement.classList.remove('hidden');
    contentElement.classList.add('hidden');
    return;
  }

  // Get AI members from cache
  const aiMembers = getCachedData('aiMembers') || [];

  // Sort members by vote count in descending order
  const sortedMembers = Object.entries(results)
    .filter(([name]) => !aiMembers.includes(name)) // Exclude AI members using cached data
    .sort(([, a], [, b]) => b - a);

  // Get the maximum votes for scaling
  const maxVotes = Math.max(...sortedMembers.map(([, votes]) => votes));

  // Create the HTML for vote results
  const resultsHTML = sortedMembers.map(([name, votes], index) => {
    // Calculate percentage for bar width
    const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
    
    return `
      <div class="relative flex items-center mb-2 h-12">
        <!-- Rank Number -->
        <div class="absolute left-0 w-8 text-center">
          <span class="text-gray-400 text-sm">#${index + 1}</span>
        </div>
        
        <!-- Name and Votes -->
        <div class="absolute left-10 right-0 flex items-center h-full">
          <!-- Bar Background -->
          <div class="absolute right-0 h-full bg-gray-700 rounded-lg" style="width: ${percentage}%">
            <!-- Gradient Overlay -->
            <div class="absolute inset-0 bg-gradient-to-l from-red-500/20 to-transparent rounded-lg"></div>
          </div>
          
          <!-- Name (left aligned) -->
          <div class="absolute left-2 z-10">
            <span class="text-white font-medium">${name}</span>
          </div>
          
          <!-- Vote Count (right aligned) -->
          <div class="absolute right-2 z-10">
            <span class="text-gray-300 font-medium">${votes}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listElement.innerHTML = resultsHTML;
  loadingElement.classList.add('hidden');
  contentElement.classList.remove('hidden');
}

// Update the vote submission function
async function submitVote(round) {
  const select = document.getElementById(`vote-${round}`);
  const button = document.querySelector(`button[onclick="submitVote(${round})"]`);
  const votedFor = select.value;
  
  if (!votedFor) {
    alert('กรุณาเลือกผู้เล่นที่ต้องการโหวต');
    return;
  }

  try {
    // Show loading state
    const originalContent = button.innerHTML;
    button.disabled = true;
    select.disabled = true;
    button.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        <span>กำลังบันทึก...</span>
      </div>
    `;

    // Get cached credentials
    const cachedCredentials = getCachedUserCredentials();
    if (!cachedCredentials) {
      throw new Error('No cached credentials found. Please login again.');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        vote: 'true',
        voterId: currentUser,
        votedFor: votedFor,
        round: round.toString(),
        pin: cachedCredentials.pin
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    // Update the vote results display with the returned data
    updateVoteResultsDisplay(result);
    
    // Show success state
    button.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>บันทึกแล้ว!</span>
      </div>
    `;
    button.classList.remove('bg-blue-600');
    button.classList.add('bg-green-600');

    // Show success popup
    const popup = document.createElement('div');
    popup.className = 'fixed inset-0 bg-gray-900/75 flex items-center justify-center z-50 p-4 animate-fade-in';
    popup.innerHTML = `
      <div class="bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-auto">
        <div class="text-center">
          <div class="flex justify-center mb-4">
            <div class="rounded-full bg-green-600/20 p-3">
              <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">โหวตสำเร็จ! 🎉</h3>
          <p class="text-gray-300 mb-4">ปรักปรำ <span class="text-yellow-400 font-medium">${votedFor}</span> เรียบร้อย</p>
          <p class="text-sm text-gray-400">หน้าต่างนี้จะปิดอัตโนมัติใน <span class="countdown">3</span> วินาที</p>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    // Add fade-in animation style
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fade-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-fade-in {
        animation: fade-in 0.2s ease-out forwards;
      }
      /* Disable pointer events on background content */
      body.popup-active > *:not(.fixed) {
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    // Add class to body to disable background interactions
    document.body.classList.add('popup-active');

    // Start countdown
    let secondsLeft = 3;
    const countdownEl = popup.querySelector('.countdown');
    const countdownInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        countdownEl.textContent = secondsLeft;
      } else {
        countdownEl.textContent = '0';
      }
    }, 1000);

    // Remove popup and reset button after delay
    setTimeout(() => {
      popup.remove();
      style.remove();
      clearInterval(countdownInterval);
      // Remove class from body to re-enable background interactions
      document.body.classList.remove('popup-active');
      
      // Reset button state
      button.innerHTML = originalContent;
      button.classList.remove('bg-green-600');
      button.classList.add('bg-blue-600');
      button.disabled = false;
      select.disabled = false;
    }, 3000);
    
  } catch (error) {
    console.error('Error submitting vote:', error);
    
    // Show error state
    button.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <span>ผิดพลาด!</span>
      </div>
    `;
    button.classList.remove('bg-blue-600');
    button.classList.add('bg-red-600');

    // Show error message
    alert(error.message || 'เกิดข้อผิดพลาดในการบันทึกการโหวต');

    // Reset button state after delay
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.classList.remove('bg-red-600');
      button.classList.add('bg-blue-600');
      button.disabled = false;
      select.disabled = false;
    }, 2000);
  }
}

// Add these utility functions for image processing
async function optimizeImage(file) {
  return new Promise((resolve, reject) => {
    // Target dimensions and quality - increased for better quality
    const MAX_WIDTH = 3840;  // 4K width
    const MAX_HEIGHT = 2160; // 4K height
    const QUALITY = 0.92;    // Very high quality JPEG
    const RAW_QUALITY = 0.95; // Near-lossless for RAW

    // Special handling for RAW formats
    const isRawFormat = file.type === 'image/x-adobe-dng' || 
                       file.name.toLowerCase().endsWith('.dng');

    // Create image object to load the file
    const img = new Image();
    img.onload = function() {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_WIDTH) {
        height = Math.round(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = Math.round(width * (MAX_HEIGHT / height));
        height = MAX_HEIGHT;
      }

      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Draw image
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF'; // White background
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use higher quality for all images
      const finalQuality = isRawFormat ? RAW_QUALITY : QUALITY;
      
      // Convert to blob
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', finalQuality);
    };
    
    img.onerror = reject;
    
    // Load image from file
    const reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Function to fetch vote results from the API
async function fetchVoteResults() {
  try {
    const data = await apiRequest({
      voteResult: 'true',
      team: currentTeam
    });
    return data;
  } catch (error) {
    console.error('Error fetching vote results:', error);
    return null;
  }
}

// Function to generate HTML for voting rounds
function generateVotingRoundsHTML(data) {
  return [1, 2, 3].map(round => `
    <div class="bg-gray-700/50 rounded-lg p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-white">รอบที่ ${round}</h3>
        <div class="flex flex-col items-end">
          ${parseInt(appConfig.active_voting_round) === round ? 
            '<span class="text-sm font-medium text-green-400">กำลังเปิดให้โหวต</span>' : 
            parseInt(appConfig.active_voting_round) < round ? 
              '<span class="text-sm font-medium text-gray-400">ยังไม่เปิดให้โหวต</span>' :
              '<span class="text-sm font-medium text-gray-400">ปิดการโหวตแล้ว</span>'
          }
          ${data.vote[`vote-${round}-timestamp`] ? 
            `<span class="text-xs text-gray-500 mt-1">โหวตเมื่อ ${new Date(data.vote[`vote-${round}-timestamp`]).toLocaleString()}</span>` : 
            ''
          }
        </div>
      </div>
      <div class="flex gap-2">
        <select 
          id="vote-${round}"
          class="flex-1 bg-gray-800 text-white rounded-lg p-2 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          ${parseInt(appConfig.active_voting_round) !== round ? 'disabled' : ''}
        >
          <option value="" ${!data.vote[`vote-${round}`] ? 'selected' : ''}>-- เลือกผู้เล่น --</option>
          ${data.team.members
            .filter(member => member !== currentUser) // Exclude current user
            .map(member => `
              <option 
                value="${member}" 
                ${data.vote[`vote-${round}`] === member ? 'selected' : ''}
              >
                ${member}
              </option>
            `).join('')}
        </select>
        <button 
          onclick="submitVote(${round})" 
          class="bg-blue-600 text-white font-medium px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          ${parseInt(appConfig.active_voting_round) !== round ? 'disabled' : ''}
        >
          บันทึก
        </button>
      </div>
    </div>
  `).join('');
}

// Function to update voting rounds with new data
function updateVotingRounds(data) {
  const container = document.getElementById('votingRoundsOuterContainer');
  if (!container) return;
  container.innerHTML = generateVotingInterfaceOuterHTML(data);
}

function generateVotingInterfaceOuterHTML(data) {
  return `
    ${parseInt(appConfig.active_voting_round) !== -1 ? 
      generateVotingInterfaceHTML(data)
    : generateVotingPlaceholderHTML()}
  `;
}

// Function to generate voting interface HTML
function generateVotingInterfaceHTML(data) {
  return `
    <div id="votingRoundsContainer" class="space-y-4">
      ${generateVotingRoundsHTML(data)}
    </div>

    <!-- Vote Results Section -->
    <div class="mt-8">
      <h3 class="text-lg font-semibold text-white mb-4">🗡️ อันดับถูกโหวต Backdoor</h3>
      <div id="voteResultsLoading" class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p class="text-gray-400 mt-2">กำลังโหลดผลโหวต...</p>
      </div>
      <div id="voteResultsContent" class="hidden">
        <div class="bg-gray-700/50 rounded-lg p-4">
          <div class="space-y-2" id="voteResultsList">
            <!-- Vote results will be populated here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

// Function to show loading state in voting rounds container
function showVotingRoundsLoading() {
  const container = document.getElementById('votingRoundsOuterContainer');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p class="text-gray-400 mt-2">กำลังโหลดข้อมูลการโหวต...</p>
      </div>
    `;
  }
}

// Function to generate placeholder HTML for voting interface
function generateVotingPlaceholderHTML() {
  return `
    <!-- Placeholder View -->
    <div class="text-center py-12">
      <div class="text-gray-700 mb-4 text-6xl">🍺🍺🍺</div>
      <p class="text-gray-500">การโหวตจะเปิดในวัน outing\nถ้าวันนี้ outing แล้วยังไม่เปิด\nดื่มน้ำเก๊กฮวยเย็นๆรอก่อนนะ...</p>
    </div>
  `;
}
