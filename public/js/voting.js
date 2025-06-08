// Cache helper functions
function setCachedData(key, value, ttl) {
  const item = {
    value: value,
    expiry: new Date().getTime() + ttl
  };
  localStorage.setItem(key, JSON.stringify(item));
}

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

// Helper function to refresh the names list
async function refreshNamesList() {
  try {
    const response = await fetch(`${API_URL}?get_names=true`);
    const data = await response.json();
    
    if (data.success && data.names) {
      // Cache the names list
      setCachedData('userNames', data.names, 5 * 60 * 1000); // Cache for 5 minutes
      return data.names;
    } else {
      throw new Error(data.error || 'Failed to fetch names');
    }
  } catch (error) {
    console.error('Error refreshing names list:', error);
    throw error;
  }
}

// Voting modal functionality
function createVoteModal() {
  const modal = document.createElement('div');
  modal.id = 'voteModal';
  modal.className = 'modal';
  modal.style.display = 'none';
  
  modal.innerHTML = `
    <div class="modal-content">
      <h2>เลือกผู้เล่นที่ต้องการโหวต</h2>
      <div id="playersList" class="players-list"></div>
      <div class="button-group">
        <button onclick="closeVoteModal()" class="cancel-btn">ยกเลิก</button>
        <button onclick="submitVote()" class="confirm-btn" id="confirmVoteBtn" disabled>ยืนยัน</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function showVoteModal() {
  const modal = document.getElementById('voteModal');
  const playersList = document.getElementById('playersList');
  playersList.innerHTML = ''; // Clear existing players
  
  // Get current player ID from localStorage
  const currentPlayerId = localStorage.getItem('playerId');
  
  // Fetch players from the cached names list
  const cachedNames = getCachedData('userNames');
  if (cachedNames) {
    displayPlayers(cachedNames, currentPlayerId);
  }
  
  // Also refresh the list to get the latest data
  refreshNamesList()
    .then(names => displayPlayers(names, currentPlayerId))
    .catch(error => {
      console.error('Error fetching players:', error);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลผู้เล่น กรุณาลองใหม่อีกครั้ง');
    });
    
  modal.style.display = 'block';
}

function displayPlayers(names, currentPlayerId) {
  const playersList = document.getElementById('playersList');
  playersList.innerHTML = ''; // Clear existing players
  
  names
    .filter(name => name.id !== currentPlayerId)
    .forEach(player => {
      const playerOption = document.createElement('label');
      playerOption.className = 'player-option';
      playerOption.innerHTML = `
        <input type="radio" name="votePlayer" value="${player.id}">
        <span>${player.name}</span>
      `;
      playersList.appendChild(playerOption);
    });
    
  // Add change listener to enable/disable confirm button
  const radioButtons = playersList.querySelectorAll('input[type="radio"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('confirmVoteBtn').disabled = false;
    });
  });
}

function closeVoteModal() {
  const modal = document.getElementById('voteModal');
  modal.style.display = 'none';
}

// Function to update all vote button states
function updateVoteButtonStates(hasVoted) {
  const isVoteEnabled = Boolean(appConfig.allow_vote);
  
  // Update floating vote button
  const voteButton = document.getElementById('voteButton');
  if (voteButton) {
    voteButton.textContent = hasVoted ? 'คุณได้โหวตแล้ว' : 'โหวต';
    voteButton.disabled = hasVoted || !isVoteEnabled;
    voteButton.title = !isVoteEnabled ? 'Voting is currently disabled' : '';
    
    if (!isVoteEnabled || hasVoted) {
      voteButton.classList.add('disabled');
    } else {
      voteButton.classList.remove('disabled');
    }
  }
  
  // Update main interface vote button
  const voteAction = document.getElementById('voteAction');
  if (voteAction) {
    voteAction.disabled = hasVoted || !isVoteEnabled;
    voteAction.title = !isVoteEnabled ? 'Voting is currently disabled' : 
                      hasVoted ? 'You have already voted' : '';
    
    voteAction.innerHTML = `
      <div class="flex flex-col items-center">
        <span>$ vote --leak</span>
        ${hasVoted ? 
          '<span class="text-xs opacity-75 mt-1">คุณได้โหวตแล้ว</span>' :
          !isVoteEnabled ? 
            '<span class="text-xs opacity-75 mt-1">จะเปิดให้โหวตวัน outing กิจกรรมกลางคืน</span>' : 
            '<span class="text-xs opacity-75 mt-1">จะเปิดให้โหวตวัน outing กิจกรรมกลางคืน</span>'
        }
      </div>
    `;
    
    if (!isVoteEnabled || hasVoted) {
      voteAction.classList.add('bg-gray-700', 'text-gray-400', 'opacity-75', 'cursor-not-allowed');
      voteAction.classList.remove('bg-yellow-600', 'hover:bg-yellow-500');
    } else {
      voteAction.classList.remove('bg-gray-700', 'text-gray-400', 'opacity-75', 'cursor-not-allowed');
      voteAction.classList.add('bg-yellow-600', 'hover:bg-yellow-500');
    }
  }
}

async function submitVote() {
  const selectedPlayer = document.querySelector('input[name="votePlayer"]:checked');
  if (!selectedPlayer) return;
  
  const currentPlayerId = localStorage.getItem('playerId');
  
  // Create form data
  const formData = new FormData();
  formData.append('vote', 'true');
  formData.append('voterId', currentPlayerId);
  formData.append('votedFor', selectedPlayer.value);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Show success message
      const playersList = document.getElementById('playersList');
      playersList.innerHTML = `
        <div class="success-message">
          <p>บันทึกการโหวตสำเร็จ</p>
          <p>คุณได้โหวตให้กับ ${data.votedPlayer}</p>
        </div>
        <button onclick="closeVoteModal()" class="ok-btn">โอเค</button>
      `;
      
      // Store that user has voted and update button states
      localStorage.setItem('hasVoted', 'true');
      updateVoteButtonStates(true);
    } else {
      throw new Error(data.error || 'Failed to record vote');
    }
  } catch (error) {
    console.error('Error voting:', error);
    alert('เกิดข้อผิดพลาดในการโหวต กรุณาลองใหม่อีกครั้ง');
  }
}

// Initialize voting functionality
document.addEventListener('DOMContentLoaded', () => {
  createVoteModal();
  
  // Initialize button states
  updateVoteButtonStates(localStorage.getItem('hasVoted') === 'true');
}); 