const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class Element {
  constructor({ innerText = '', attributes = {}, querySelectors = {} } = {}) {
    this.innerText = innerText
    this.attributes = attributes
    this.querySelectors = querySelectors
    this.parentElement = null
  }

  getAttribute(name) {
    return this.attributes[name]
  }

  querySelector(selector) {
    return this.querySelectors[selector] || null
  }
}

class Product {
  constructor(id, { price = null, reviewElements = {} } = {}) {
    this.id = id
    this.attributes = {}
    this.style = {}
    this.innerText = `${id} free delivery`
    this.reviewElements = reviewElements
    this.priceEl = price === null ? null : createPriceElement(price)
    this.parentElement = null
  }

  hasAttribute(name) {
    return Object.hasOwn(this.attributes, name)
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value)
  }

  getAttribute(name) {
    return this.attributes[name]
  }

  querySelector(selector) {
    if (selector === '.a-price .a-offscreen') return this.priceEl
    if (selector === '.puis-sponsored-label-text') return null
    return this.reviewElements[selector] || null
  }

  querySelectorAll(selector) {
    if (selector === 'h2') {
      return [{ innerText: this.id }]
    }

    return []
  }
}

class Parent {
  constructor(children) {
    this.children = children
    for (const child of children) {
      child.parentElement = this
    }
  }

  set textContent(_value) {
    this.children = []
  }

  appendChild(child) {
    this.children.push(child)
    child.parentElement = this
  }
}

const createPriceElement = unitPrice => {
  const unitPriceEl = new Element({ innerText: `($${unitPrice.toFixed(2)}/oz)` })
  const unitPriceParent = new Element({
    querySelectors: { '.a-size-base.a-color-secondary': unitPriceEl },
  })
  const priceWrapper = new Element()
  const priceEl = new Element({ innerText: '$10.00' })

  priceEl.parentElement = priceWrapper
  priceWrapper.parentElement = unitPriceParent

  return priceEl
}

const runContentScript = products => {
  const parent = new Parent(products)
  const sandbox = {
    console,
    URL,
    window: { location: { href: 'https://www.amazon.com.au/s?k=candle' } },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    document: {
      body: { contains: () => true },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: selector => {
        if (selector === '.s-search-results [data-component-type="s-search-result"]') {
          return parent.children
        }

        return []
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener: () => {},
        },
      },
    },
    setInterval: () => {},
    setTimeout: callback => callback(),
  }

  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync('content.js', 'utf8'), sandbox)

  return { parent, filterProducts: sandbox.filterProducts }
}

const auReviewElement = count => new Element({
  innerText: `(${count})`,
  attributes: { 'aria-label': `${count} ratings` },
})

const legacyReviewElement = count => new Element({ innerText: count })

const testMinimumReviewsCount = () => {
  const legacy = new Product('legacy', {
    reviewElements: {
      '.a-size-small a .a-size-base': legacyReviewElement('1.2K'),
    },
  })
  const au = new Product('au', {
    reviewElements: {
      '[data-cy="reviews-block"] a[href*="#customerReviews"]': auReviewElement(186),
    },
  })
  const low = new Product('low', {
    reviewElements: {
      '[data-cy="reviews-block"] a[href*="#customerReviews"]': auReviewElement(27),
    },
  })
  const missing = new Product('missing')
  const { parent, filterProducts } = runContentScript([legacy, au, low, missing])

  filterProducts({ minimumReviewsCount: 100 })

  const displays = Object.fromEntries(parent.children.map(product => [product.id, product.style.display]))
  assert.strictEqual(displays.legacy, 'block')
  assert.strictEqual(displays.au, 'block')
  assert.strictEqual(displays.low, 'none')
  assert.strictEqual(displays.missing, 'none')
}

const testSortByUnitPriceToggle = () => {
  const first = new Product('first', { price: 3 })
  const second = new Product('second', { price: 1 })
  const third = new Product('third', { price: 2 })
  const { parent, filterProducts } = runContentScript([first, second, third])

  filterProducts({ sortByUnitPrice: true })
  assert.deepStrictEqual(parent.children.map(product => product.id), ['second', 'third', 'first'])

  filterProducts({ sortByUnitPrice: false })
  assert.deepStrictEqual(parent.children.map(product => product.id), ['first', 'second', 'third'])
}

testMinimumReviewsCount()
testSortByUnitPriceToggle()

console.log('content script regression tests passed')
