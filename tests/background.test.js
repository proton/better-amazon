const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const calls = []
const tabsById = {}
let onUpdated
let onActivated
let onMessage

const sandbox = {
  URL,
  chrome: {
    action: {
      setIcon: payload => calls.push(payload),
    },
    runtime: {
      onMessage: {
        addListener: callback => { onMessage = callback },
      },
    },
    tabs: {
      get: (tabId, callback) => callback(tabsById[tabId]),
      onActivated: {
        addListener: callback => { onActivated = callback },
      },
      onUpdated: {
        addListener: callback => { onUpdated = callback },
      },
    },
  },
}

const iconPath = payload => payload.path[48]

vm.createContext(sandbox)
vm.runInContext(fs.readFileSync('background.js', 'utf8'), sandbox)

assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-grey-48.png')

onMessage(
  { type: 'AMAZON_PAGE_READY' },
  { tab: { id: 1, url: 'https://www.amazon.com/s?k=candle' } },
)
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-48.png')

onUpdated(1, {}, { url: 'https://www.amazon.com/s?k=candle' })
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-48.png')

onUpdated(2, {}, { url: 'https://www.amazon.com.au/s?k=candle' })
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-48.png')

onUpdated(3, {}, { url: 'https://notamazon.com/' })
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-grey-48.png')

onUpdated(4, {}, {})
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-grey-48.png')

tabsById[5] = { url: 'https://sellercentral.amazon.com/' }
onActivated({ tabId: 5 })
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-48.png')

tabsById[6] = {}
onActivated({ tabId: 6 })
assert.strictEqual(iconPath(calls.at(-1)), 'images/icon-grey-48.png')

console.log('background icon tests passed')
