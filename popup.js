let currentPin = '';

document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('savePin');
  const lockButton = document.getElementById('lockNow');

  saveButton.addEventListener('click', saveNewPin);
  lockButton.addEventListener('click', lockBrowser);

  // Check if PIN is already set and if the browser is locked
  chrome.storage.sync.get(['pin', 'isLocked'], (result) => {
    if (!result.pin) {
      document.getElementById('currentPin').style.display = 'none';
      document.getElementById('lockNow').style.display = 'none';
    } else {
      // If the browser is locked, hide the "Lock Browser Now" button
      if (result.isLocked) {
        document.getElementById('lockNow').style.display = 'none';
      } else {
        document.getElementById('lockNow').style.display = 'block';
      }
    }
  });
});

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const messageElement = notification.querySelector('.notification-message');
  
  messageElement.textContent = message;
  notification.className = `notification ${type} show`;

  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);

  // Close button functionality
  const closeButton = notification.querySelector('.notification-close');
  closeButton.onclick = () => notification.classList.remove('show');
}

async function saveNewPin() {
  const currentPinInput = document.getElementById('currentPin');
  const newPinInput = document.getElementById('newPin');
  const confirmPinInput = document.getElementById('confirmPin');

  const currentPinValue = currentPinInput.value;
  const newPin = newPinInput.value;
  const confirmPin = confirmPinInput.value;

  // Validate PIN
  if (!/^\d{4}$/.test(newPin)) {
    showNotification('PIN должен состоять из 4 цифр', 'error');
    return;
  }

  if (newPin !== confirmPin) {
    showNotification('PIN-коды не совпадают', 'error');
    return;
  }

  // Check current PIN if it exists
  const { pin } = await chrome.storage.sync.get(['pin']);
  if (pin && currentPinValue !== pin) {
    showNotification('Неверный текущий PIN', 'error');
    return;
  }

  // Save new PIN
  await chrome.storage.sync.set({ pin: newPin });
  showNotification('PIN успешно сохранен');

  // Show lock button after PIN is set (only if the browser is not locked)
  chrome.storage.sync.get(['isLocked'], (result) => {
    if (!result.isLocked) {
      document.getElementById('lockNow').style.display = 'block';
    }
  });

  // Clear inputs
  currentPinInput.value = '';
  newPinInput.value = '';
  confirmPinInput.value = '';
}

function lockBrowser() {
  chrome.runtime.sendMessage({ action: 'lock' });
  window.close();
}

// Handle star rating
document.querySelectorAll('.star').forEach(star => {
  star.addEventListener('click', () => {
    const rating = star.dataset.rating;
    const extensionId = chrome.runtime.id;
    const chromeStoreUrl = `https://chrome.google.com/webstore/detail/${extensionId}`;
    chrome.tabs.create({ url: chromeStoreUrl });
  });
});