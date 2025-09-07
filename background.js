const getIconsPath = (isGrayed) => {
  const iconSizes = [48, 128, 512]
  const colorSuffix = isGrayed ? 'grey-' : ''

  return iconSizes.reduce((acc, size) => {
    acc[size] = `images/icon-${colorSuffix}${size}.png`
    return acc
  }, {})
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isAmazon = tab.url.includes('amazon.')

    chrome.action.setIcon({
      path: getIconsPath(!isAmazon),
      tabId,
    })
  }
})