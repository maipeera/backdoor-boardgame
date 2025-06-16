// Cache helper function
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

class VoteModal {
  constructor() {
    this.isOpen = false;
    this.selectedMember = null;
    this.isSubmitting = false;
    this.previousVote = null;
    this.createModal();
  }

  createModal() {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-4 hidden';
    this.modalElement.style.pointerEvents = 'all';
    
    const modalContent = `
      <div class="bg-gray-800 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col relative">
        <div class="p-4 border-b border-gray-700 modal-header">
          <h2 class="text-xl font-semibold text-white">โหวตคนที่คิดว่าเป็น Backdoor</h2>
          <p class="text-sm text-gray-400 mt-1 previous-vote-text hidden"></p>
          <div class="mt-2 bg-gray-700/50 rounded-t-lg border-t border-l border-r border-gray-600 p-3 revote-message hidden">
            <p class="text-gray-200">เคยโหวตไปแล้ว แต่เปลี่ยนใจได้นะ เข้าใจแหละว่ามันเชื่อใจกันไม่ค่อยได้ ใครก็ดูไม่น่าเชื่อไปซะหมด😈</p>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4">
          <div class="member-list space-y-2"></div>
        </div>

        <div class="p-4 border-t border-gray-700 flex justify-end space-x-3 modal-footer">
          <button class="px-4 py-2 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 cancel-btn">
            ยกเลิก
          </button>
          <button class="confirm-btn px-4 py-2 rounded-lg bg-gray-600 text-gray-400 cursor-not-allowed" disabled>
            โหวตเลยจ้าาา
          </button>
        </div>
      </div>
    `;
    
    this.modalElement.innerHTML = modalContent;
    document.body.appendChild(this.modalElement);

    // Add event listeners
    this.modalElement.addEventListener('click', (e) => {
      // Close modal when clicking the backdrop (outside the modal content)
      if (e.target === this.modalElement) {
        this.close();
      }
    });
    
    this.modalElement.querySelector('.cancel-btn').addEventListener('click', () => this.close());
    this.modalElement.querySelector('.confirm-btn').addEventListener('click', () => this.handleVote());
  }

  updateMemberList() {
    const memberListElement = this.modalElement.querySelector('.member-list');
    memberListElement.innerHTML = '';
    
    // Get team members from cache using getCachedData
    const cachedMembers = getCachedData('teamMembers') || [];
    const aiMembers = getCachedData('aiMembers') || [];
    
    // Filter out AI members
    const filteredMembers = cachedMembers.filter(member => !aiMembers.includes(member.name));
    
    filteredMembers.forEach(member => {
      const button = document.createElement('button');
      button.className = `w-full p-3 rounded-lg text-left transition-colors ${
        this.selectedMember === member.name
          ? 'bg-yellow-600 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      }`;
      
      let buttonText = member.name;
      if (this.previousVote === member.name) {
        buttonText += ' <span class="ml-2 text-sm opacity-75">(Current vote)</span>';
      }
      button.innerHTML = buttonText;
      
      button.addEventListener('click', () => this.selectMember(member.name));
      memberListElement.appendChild(button);
    });
  }

  selectMember(memberName) {
    this.selectedMember = memberName;
    this.updateMemberList();
    
    // Find the confirm button within the modal content
    const confirmBtn = this.modalElement.querySelector('.confirm-btn');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.className = 'px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 confirm-btn';
    }
  }

  async handleVote() {
    if (!this.selectedMember || this.isSubmitting) return;
    
    this.isSubmitting = true;
    const confirmBtn = this.modalElement.querySelector('.confirm-btn');
    const cancelBtn = this.modalElement.querySelector('.cancel-btn');
    confirmBtn.textContent = '🚀🚀...';
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    
    try {
      const currentUserId = localStorage.getItem('currentUserId');
      const formData = new FormData();
      formData.append('vote', 'true');
      formData.append('voterId', currentUserId);
      formData.append('votedFor', this.selectedMember);
      
      const response = await fetch(`${ENV.API_URL}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        // Hide header and footer
        const headerSection = this.modalElement.querySelector('.modal-header');
        const footerSection = this.modalElement.querySelector('.modal-footer');
        headerSection.style.display = 'none';
        footerSection.style.display = 'none';

        // Show success message
        const memberList = this.modalElement.querySelector('.member-list');
        memberList.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full py-12 space-y-8">
            <p class="text-2xl font-semibold text-white">โหวตเรียบร้อย</p>
            <div class="text-center">
              <p class="text-4xl font-bold text-yellow-500 mb-4">${data.votedPlayer}</p>
              <p class="text-gray-400 countdown">หน้าจะปิดใน 5 วินาที</p>
            </div>
          </div>
        `;

        localStorage.setItem('hasVoted', 'true');
        localStorage.setItem('votedFor', this.selectedMember);
        
        // Start countdown
        let secondsLeft = 5;
        const countdownEl = memberList.querySelector('.countdown');
        const countdownInterval = setInterval(() => {
          secondsLeft--;
          if (secondsLeft > 0) {
            countdownEl.textContent = `หน้าจะปิดใน ${secondsLeft} วินาที`;
          } else {
            countdownEl.textContent = 'กำลังปิด...';
            clearInterval(countdownInterval);
          }
        }, 1000);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          clearInterval(countdownInterval);
          this.close();
        }, 5000);
      } else {
        throw new Error(data.error || 'Failed to record vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('เกิดข้อผิดพลาดในการโหวต กรุณาลองใหม่อีกครั้ง');
      
      // Reset to ready state on error
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.className = 'px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-500 confirm-btn';
    }
    
    this.isSubmitting = false;
    confirmBtn.textContent = 'โหวตเลยจ้าาา';
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
  }

  open() {
    this.isOpen = true;
    this.previousVote = localStorage.getItem('votedFor');
    this.selectedMember = this.previousVote;
    
    // Reset visibility of header and footer sections
    const headerSection = this.modalElement.querySelector('.modal-header');
    const footerSection = this.modalElement.querySelector('.modal-footer');
    headerSection.style.display = 'block';
    footerSection.style.display = 'flex';
    
    // Update previous vote text and revote message
    const previousVoteText = this.modalElement.querySelector('.previous-vote-text');
    const revoteMessage = this.modalElement.querySelector('.revote-message');
    
    if (this.previousVote) {
      previousVoteText.textContent = `คราวก่อนโหวต ${this.previousVote} ไปแล้วนะ`;
      previousVoteText.classList.remove('hidden');
      revoteMessage.classList.remove('hidden');
    } else {
      previousVoteText.classList.add('hidden');
      revoteMessage.classList.add('hidden');
    }
    
    this.updateMemberList();
    this.modalElement.classList.remove('hidden');
    this.modalElement.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  close() {
    this.isOpen = false;
    this.modalElement.classList.add('hidden');
    this.modalElement.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
}

// Export the modal class
window.VoteModal = VoteModal; 