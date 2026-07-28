const getIconsPath = (isGrayed) => {
  const iconSizes = [48, 128, 512]
  const colorSuffix = isGrayed ? 'grey-' : ''
  return iconSizes.reduce((acc, size) => {
    acc[size] = `images/icon-${colorSuffix}${size}.png`
    return acc
  }, {})
}

const AMAZON_HOSTS = [
  'amazon.com',
  'amazon.ca',
  'amazon.cn',
  'amazon.co.jp',
  'amazon.co.uk',
  'amazon.com.au',
  'amazon.de',
  'amazon.es',
  'amazon.fr',
  'amazon.in',
  'amazon.it',
  'amazon.nl',
  'amazon.com.mx',
  'amazon.sg',
  'amazon.se',
  'amazon.sa',
  'amazon.ae',
  'amazon.com.tr',
  'amazon.com.br',
]

const isAmazonUrl = url => {
  if (!url) return false

  try {
    const hostname = new URL(url).hostname
    return AMAZON_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))
  } catch (err) {
    return false
  }
}

function updateIconForTab(tabId, url) {
  chrome.action.setIcon({
    path: getIconsPath(!isAmazonUrl(url)),
    tabId,
  })
}

chrome.action.setIcon({ path: getIconsPath(true) })

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'AMAZON_PAGE_READY' && sender.tab?.id !== undefined) {
    updateIconForTab(sender.tab.id, sender.tab.url)
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  updateIconForTab(tabId, tab?.url || changeInfo?.url)
})

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    updateIconForTab(activeInfo.tabId, tab?.url)
  })
})
