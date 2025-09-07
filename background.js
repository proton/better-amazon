const getIconsPath = (isGrayed) => {
  const iconSizes = [48, 128, 512]
  const colorSuffix = isGrayed ? 'grey-' : ''
  return iconSizes.reduce((acc, size) => {
    acc[size] = `images/icon-${colorSuffix}${size}.png`
    return acc
  }, {})
}

function updateIconForTab(tabId, url) {
  const isAmazon = url?.includes('amazon.')
  chrome.action.setIcon({
    path: getIconsPath(!isAmazon),
    tabId,
  })
}

chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  if (tab.url) {
    updateIconForTab(tabId, tab?.url)
  }
})

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateIconForTab(tab.id, tab?.url)
  })
})