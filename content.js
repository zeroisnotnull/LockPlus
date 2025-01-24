// Wrap the entire content script in an IIFE
(function () {
  // Content script that will be injected into pages
  let isLocked = false;
  let isInitialized = false;

  // Initialize the content script
  function initialize() {
    if (isInitialized) return;
    isInitialized = true;

    // Check initial lock state
    chrome.storage.sync.get(['isLocked'], (result) => {
      if (result.isLocked) {
        isLocked = true;
        createLockScreen();
      }
    });

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateLockState') {
        isLocked = request.isLocked;
        if (isLocked) {
          createLockScreen();
        } else {
          removeLockScreen();
        }
        // Send acknowledgment
        sendResponse({ success: true });
      }
      return true; // Keep the message channel open for sendResponse
    });
  }

  // Initialize as soon as possible
  initialize();

  function createLockScreen() {
    if (document.getElementById('browser-lock-screen')) return;

    const lockScreen = document.createElement('div');
    lockScreen.id = 'browser-lock-screen';
    
    const container = document.createElement('div');
    container.className = 'lock-container';
    
    const title = document.createElement('div');
    title.className = 'lock-title';
    title.innerHTML = '🔒<br>Браузер заблокирован';
    
    const pinDisplay = document.createElement('div');
    pinDisplay.className = 'pin-display';
    pinDisplay.id = 'pin-display';
    for (let i = 0; i < 4; i++) {
      const dot = document.createElement('div');
      dot.className = 'pin-dot';
      pinDisplay.appendChild(dot);
    }
    
    const pinPad = document.createElement('div');
    pinPad.className = 'pin-pad';
    
    // Create number pad with 0 under 8
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', null];
    numbers.forEach(num => {
      if (num !== null) {
        const button = document.createElement('button');
        button.className = 'pin-digit';
        button.textContent = num;
        button.dataset.digit = num;
        pinPad.appendChild(button);
      } else {
        // Add empty space for grid alignment
        const spacer = document.createElement('div');
        pinPad.appendChild(spacer);
      }
    });
    
    container.appendChild(title);
    container.appendChild(pinDisplay);
    container.appendChild(pinPad);
    lockScreen.appendChild(container);
    
    // Prevent page interaction
    document.addEventListener('contextmenu', preventEvent, true);
    document.addEventListener('selectstart', preventEvent, true);
    document.addEventListener('copy', preventEvent, true);
    document.addEventListener('cut', preventEvent, true);
    document.addEventListener('paste', preventEvent, true);
    document.addEventListener('keydown', preventEvent, true);
    
    // Insert the lock screen as the first child of body
    if (document.body) {
      document.body.insertBefore(lockScreen, document.body.firstChild);
      setupPinHandling();
    } else {
      // If body doesn't exist yet, wait for it
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
          document.body.insertBefore(lockScreen, document.body.firstChild);
          setupPinHandling();
          obs.disconnect();
        }
      });
      
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function preventEvent(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }

  function removeLockScreen() {
    const lockScreen = document.getElementById('browser-lock-screen');
    if (lockScreen) {
      lockScreen.remove();
    }
    
    // Remove event listeners
    document.removeEventListener('contextmenu', preventEvent, true);
    document.removeEventListener('selectstart', preventEvent, true);
    document.removeEventListener('copy', preventEvent, true);
    document.removeEventListener('cut', preventEvent, true);
    document.removeEventListener('paste', preventEvent, true);
    document.removeEventListener('keydown', preventEvent, true);
  }

  function setupPinHandling() {
    let enteredPin = '';
    let lastAttemptTime = 0;
    let failedAttempts = 0;
    let countdownInterval = null;

    function startCountdown(seconds) {
      const countdownElement = document.createElement('div');
      countdownElement.className = 'pin-error';
      countdownElement.textContent = `Слишком много неудачных попыток. Пожалуйста, подождите ${seconds} секунд.`;
      document.querySelector('.lock-container').appendChild(countdownElement);

      countdownInterval = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(countdownInterval);
          countdownElement.remove();
          failedAttempts = 0;
        } else {
          countdownElement.textContent = `Слишком много неудачных попыток. Пожалуйста, подождите ${seconds} секунд.`;
        }
      }, 1000);
    }

    function handlePinInput(digit) {
      const now = Date.now();
      
      // Implement rate limiting
      if (now - lastAttemptTime < 500) {
        return;
      }
      
      // Check for too many failed attempts
      if (failedAttempts >= 5) {
        const waitTime = Math.min(30000 * Math.pow(2, failedAttempts - 5), 3600000);
        if (now - lastAttemptTime < waitTime) {
          const remainingTime = Math.ceil((waitTime - (now - lastAttemptTime)) / 1000);
          if (!countdownInterval) {
            startCountdown(remainingTime);
          }
          return;
        }
        failedAttempts = 0;
      }
      
      enteredPin += digit;
      updatePinDisplay();
      
      if (enteredPin.length === 4) {
        lastAttemptTime = now;
        
        chrome.storage.sync.get(['pin'], (result) => {
          if (enteredPin === result.pin) {
            failedAttempts = 0;
            chrome.runtime.sendMessage({ action: 'unlock' });
          } else {
            failedAttempts++;
            enteredPin = '';
            updatePinDisplay();
            showError('Неверный PIN');
          }
        });
      }
    }
    
    function showError(message) {
      const existingError = document.querySelector('.pin-error');
      if (existingError) {
        existingError.remove();
      }
      
      const error = document.createElement('div');
      error.className = 'pin-error';
      error.textContent = message;
      
      document.querySelector('.lock-container').appendChild(error);
      
      setTimeout(() => error.remove(), 3000);
    }
    
    function updatePinDisplay() {
      const dots = document.querySelectorAll('.pin-dot');
      dots.forEach((dot, index) => {
        dot.classList.toggle('filled', index < enteredPin.length);
      });
    }
    
    // Add click event listeners to all pin digits
    document.querySelectorAll('.pin-digit').forEach(button => {
      button.addEventListener('click', (e) => {
        const digit = e.target.dataset.digit;
        if (digit) {
          handlePinInput(digit);
        }
      });
    });
  }
})();