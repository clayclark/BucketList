chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// An early build recorded raw draft-room traffic for debugging. Drop anything it left behind.
chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove('capture'))
