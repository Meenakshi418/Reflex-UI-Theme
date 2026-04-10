// FocusFlow – Background Service Worker

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'SET_BADGE') {
    const score = msg.score;
    const tabId = sender.tab?.id;
    if (!tabId) return;

    let color = '#4caf50'; // green
    let text = '';
    if (score >= 30) { color = '#ff9800'; text = '!'; }
    if (score >= 60) { color = '#f44336'; text = '!!'; }

    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  }
});

chrome.tabs.onActivated.addListener(() => {
  // forward message to active tab to refresh score display
});
