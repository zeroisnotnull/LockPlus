// Initialize lock state
let isLocked = false;

// Function to check if a tab is valid for injection
function isValidTab(tab) {
  if (!tab.url) return false;
  
  const invalidProtocols = [
    'chrome://',
    'chrome-extension://',
    'chrome-search://',
    'chrome-devtools://',
    'devtools://',
    'about:',
    'edge://',
    'brave://',
    'opera://',
    'vivaldi://',
    'file://'
  ];
  
  const invalidDomains = [
    'google.com'
  ];
  
  const isInvalidProtocol = invalidProtocols.some(protocol => tab.url.startsWith(protocol));
  const isInvalidDomain = invalidDomains.some(domain => tab.url.includes(domain));
  
  return !isInvalidProtocol && !isInvalidDomain;
}

// Function to inject content script
async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['styles.css']
    });
  } catch (error) {
    console.error('Error injecting content script:', error);
    // Fallback: Close the tab or redirect to a safe page
    chrome.tabs.remove(tabId);
  }
}

// Function to update tab lock state
async function updateTabLockState(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !isValidTab(tab)) return;

    await injectContentScript(tabId);
    
    try {
      await chrome.tabs.sendMessage(tabId, { 
        action: 'updateLockState',
        isLocked: isLocked
      });
    } catch (error) {
      console.error('Error sending message to tab:', error);
    }
  } catch (error) {
    console.error('Error updating tab lock state:', error);
  }
}

// Function to lock all tabs
async function lockAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (isValidTab(tab)) {
        await updateTabLockState(tab.id);
      }
    }
  } catch (error) {
    console.error('Failed to lock all tabs:', error);
  }
}

// Function to unlock all tabs
async function unlockAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (isValidTab(tab)) {
        await updateTabLockState(tab.id);
      }
    }
  } catch (error) {
    console.error('Failed to unlock all tabs:', error);
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'lock') {
    isLocked = true;
    chrome.storage.sync.set({ isLocked: true }, () => {
      lockAllTabs();
    });
  } else if (request.action === 'unlock') {
    isLocked = false;
    chrome.storage.sync.set({ isLocked: false }, () => {
      unlockAllTabs();
    });
  }
  return true;
});

// Monitor tab updates and creation
chrome.webNavigation.onCommitted.addListener((details) => {
  if (isLocked) {
    updateTabLockState(details.tabId);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (isLocked) {
    updateTabLockState(tab.id);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isLocked && changeInfo.status === 'loading') {
    updateTabLockState(tabId);
  }
});

// Initialize lock state from storage
chrome.storage.sync.get(['isLocked'], (result) => {
  isLocked = result.isLocked || false;
  if (isLocked) {
    lockAllTabs();
  }
});