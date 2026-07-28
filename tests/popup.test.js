const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const AMAZON_PERMISSION = 'https://www.amazon.com/*'
const FILTER_FIELDS = [
  'minimumReviewsCount',
  'freeDelivery',
  'removeSponsoredAndFeatured',
  'sortByUnitPrice',
  'negativeWords',
  'positiveWords',
  'minPrice',
  'maxPrice',
]

const nextTick = () => new Promise(resolve => setImmediate(resolve))
const plain = value => JSON.parse(JSON.stringify(value))

const createElement = () => ({
  value: '',
  checked: false,
  disabled: false,
  style: {},
  listeners: {},
  addEventListener(type, callback) {
    this.listeners[type] = callback
  },
})

const runPopup = ({ hasPermission, requestGranted = true }) => {
  const elements = {
    filtersForm: createElement(),
    'not-allowed-message': createElement(),
    'status-message': createElement(),
    'grant-permission': createElement(),
  }
  FILTER_FIELDS.forEach(id => { elements[id] = createElement() })

  const messages = []
  const requestedPermissions = []
  let reloadedTabId = null
  let popupClosed = false

  const sandbox = {
    URL,
    console,
    document: {
      getElementById: id => elements[id],
    },
    window: {
      close: () => { popupClosed = true },
    },
    chrome: {
      permissions: {
        contains: async () => hasPermission,
        request: async permissions => {
          requestedPermissions.push(permissions)
          return requestGranted
        },
      },
      runtime: {
        getManifest: () => ({ host_permissions: [AMAZON_PERMISSION] }),
      },
      tabs: {
        query: (_query, callback) => {
          callback([{ id: 7, url: 'https://www.amazon.com/s?k=battery' }])
        },
        reload: (tabId, callback) => {
          reloadedTabId = tabId
          callback()
        },
        sendMessage: (tabId, message) => {
          messages.push({ tabId, message })
          return Promise.resolve({ filters: { sortByUnitPrice: true } })
        },
      },
    },
  }

  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync('popup.js', 'utf8'), sandbox)

  return {
    elements,
    messages,
    requestedPermissions,
    get reloadedTabId() { return reloadedTabId },
    get popupClosed() { return popupClosed },
  }
}

const testPermissionRequest = async () => {
  const result = runPopup({ hasPermission: false })
  await nextTick()

  assert.strictEqual(
    result.elements['status-message'].textContent,
    'Allow access to this Amazon site to apply filters automatically.',
  )
  assert.strictEqual(result.elements['grant-permission'].style.display, '')
  assert.strictEqual(result.messages.length, 0)

  await result.elements['grant-permission'].listeners.click()

  assert.deepStrictEqual(
    plain(result.requestedPermissions),
    [{ origins: [AMAZON_PERMISSION] }],
  )
  assert.strictEqual(result.reloadedTabId, 7)
  assert.strictEqual(result.popupClosed, true)
}

const testGrantedPermission = async () => {
  const result = runPopup({ hasPermission: true })
  await nextTick()
  await nextTick()

  assert.strictEqual(result.elements.filtersForm.style.display, '')
  assert.strictEqual(result.elements['not-allowed-message'].style.display, 'none')
  assert.strictEqual(result.elements.sortByUnitPrice.checked, true)
  assert.deepStrictEqual(
    plain(result.messages.map(({ message }) => message.type)),
    ['LOAD_FILTERS', 'APPLY_FILTERS'],
  )
}

const main = async () => {
  await testPermissionRequest()
  await testGrantedPermission()
  console.log('popup permission tests passed')
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
