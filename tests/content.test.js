const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

class Element {
  constructor({ innerText = '', attributes = {}, querySelectors = {}, closestElement = null } = {}) {
    this.innerText = innerText
    this.attributes = attributes
    this.querySelectors = querySelectors
    this.closestElement = closestElement
    this.parentElement = null
    this.removed = false
  }

  getAttribute(name) {
    return this.attributes[name]
  }

  querySelector(selector) {
    return this.querySelectors[selector] || null
  }

  querySelectorAll(selector) {
    const element = this.querySelector(selector)
    return element ? [element] : []
  }

  closest() {
    return this.closestElement
  }

  remove() {
    this.removed = true
    if (this.parentElement?.children) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this)
    }
  }
}

class Product {
  constructor(
    id,
    {
      price = null,
      priceText = null,
      reviewElements = {},
      hasUnitPriceWrapper = true,
      resultPosition = null,
      unitPriceText = null,
      unitPriceLayout = 'legacy',
      unitPriceSelector = '.a-size-base.a-color-secondary',
    } = {},
  ) {
    this.id = id
    this.attributes = {}
    this.style = {}
    this.innerText = `${id} free delivery`
    this.reviewElements = reviewElements
    this.resultPosition = resultPosition
    this.priceEl = price === null && priceText === null ? null : createPriceElement({
      unitPrice: price,
      priceText,
      hasUnitPriceWrapper,
      unitPriceText,
      unitPriceLayout,
      unitPriceSelector,
    })
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
    if (selector === '[data-csa-c-pos]' && this.resultPosition !== null) {
      return new Element({ attributes: { 'data-csa-c-pos': String(this.resultPosition) } })
    }
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

const createPriceElement = ({ unitPrice, priceText, hasUnitPriceWrapper, unitPriceText, unitPriceLayout, unitPriceSelector }) => {
  const unitPriceEl = new Element({ innerText: unitPriceText || `($${unitPrice.toFixed(2)}/oz)` })
  const unitPriceParent = new Element({
    querySelectors: { [unitPriceSelector]: unitPriceEl },
  })
  const priceWrapper = new Element()
  const priceEl = new Element({ innerText: priceText || '$10.00' })

  if (!hasUnitPriceWrapper) {
    return priceEl
  }

  if (unitPriceLayout === 'sibling') {
    const priceNode = new Element()
    const priceAnchor = new Element({
      querySelectors: { [unitPriceSelector]: unitPriceEl },
    })

    priceEl.parentElement = priceNode
    priceNode.parentElement = priceWrapper
    priceWrapper.parentElement = priceAnchor

    return priceEl
  }

  priceEl.parentElement = priceWrapper
  priceWrapper.parentElement = unitPriceParent

  return priceEl
}

const createPaginationContainer = page => {
  const widget = new Element()
  const selected = new Element({ innerText: String(page) })
  const container = new Element({
    querySelectors: { '.s-pagination-selected': selected },
    closestElement: widget,
  })
  widget.querySelectors['.s-pagination-selected'] = selected
  container.parentElement = widget

  return { container, widget }
}

const runContentScript = (products, url = 'https://www.amazon.com.au/s?k=candle', { paginationContainers = [] } = {}) => {
  const parent = new Parent(products)
  const sandbox = {
    console,
    URL,
    window: { location: { href: url } },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    document: {
      body: { contains: element => !element.removed },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: selector => {
        if (selector === '.s-search-results [data-component-type="s-search-result"]') {
          return parent.children
        }
        if (selector === '.s-pagination-container') {
          return paginationContainers.filter(container => !container.removed && !container.closestElement?.removed)
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

  return {
    evaluate: expression => vm.runInContext(expression, sandbox),
    parent,
    filterProducts: sandbox.filterProducts,
  }
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

const testSortByUnitPriceWithoutWrapper = () => {
  const wrapped = new Product('wrapped', { price: 1 })
  const plain = new Product('plain', { price: 2, hasUnitPriceWrapper: false })
  const { parent, filterProducts } = runContentScript([plain, wrapped])

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(product => product.id), ['wrapped', 'plain'])
}

const testPriceFallbackParsing = () => {
  const wholeDollars = new Product('whole', {
    price: 100,
    priceText: '$71',
    hasUnitPriceWrapper: false,
  })
  const decimalWithThousands = new Product('decimal', {
    price: 100,
    priceText: '$1,234.56',
    hasUnitPriceWrapper: false,
  })
  const { parent, filterProducts } = runContentScript([decimalWithThousands, wholeDollars])

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(product => product.id), ['whole', 'decimal'])
}

const testSortByModernUnitPriceMarkup = () => {
  const oldMarkup = new Product('old-markup', { price: 3 })
  const newMarkup = new Product('new-markup', {
    price: 1,
    unitPriceText: ' ($7.31 /  count)',
    unitPriceLayout: 'sibling',
    unitPriceSelector: '.a-size-small.a-color-base',
  })
  const { parent, filterProducts } = runContentScript([oldMarkup, newMarkup])

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(product => product.id), ['old-markup', 'new-markup'])
}

const testSortByBaseUnitPriceBeforeFullPrice = () => {
  const expensiveUnitPrice = new Product('12.40-per-count', {
    price: 12.40,
    priceText: '$24.79',
    unitPriceText: '($12.40/count)',
    unitPriceLayout: 'sibling',
    unitPriceSelector: '.a-size-base.a-color-base',
  })
  const cheaperUnitPrice = new Product('4.66-per-count', {
    price: 4.66,
    priceText: '$27.96',
    unitPriceText: '($4.66/count)',
    unitPriceLayout: 'sibling',
    unitPriceSelector: '.a-size-base.a-color-base',
  })
  const { parent, filterProducts } = runContentScript([expensiveUnitPrice, cheaperUnitPrice])

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(product => product.id), ['4.66-per-count', '12.40-per-count'])
}

const testSortByUnitPriceNumberFormats = () => {
  const wholeUnit = new Product('whole-unit', {
    price: 5,
    unitPriceText: '($2 / count)',
  })
  const decimalComma = new Product('decimal-comma', {
    price: 5,
    unitPriceText: '(1,50 €/kg)',
  })
  const { parent, filterProducts } = runContentScript([wholeUnit, decimalComma])

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(product => product.id), ['decimal-comma', 'whole-unit'])
}

const testCustomFilterKeys = () => {
  const { evaluate } = runContentScript([], 'https://www.amazon.com/s?k=candle&crid=ABC123&rh=n%3A1055398')

  assert.deepStrictEqual(Array.from(evaluate('customFiltersKeys()')), [
    'CUSTOM_AMAZON_FILTERS_KEY-ABC123',
    'CUSTOM_AMAZON_FILTERS_KEY-candle',
    'CUSTOM_AMAZON_FILTERS_KEY-1055398',
  ])
}

const testEmptySearchResults = () => {
  const { filterProducts } = runContentScript([])

  assert.doesNotThrow(() => filterProducts({ sortByUnitPrice: true }))
}

const testRemovesStalePagination = () => {
  const stalePagination = createPaginationContainer(1)
  const currentPagination = createPaginationContainer(3)
  const products = [
    new Product('page-3-first', { resultPosition: 97 }),
    new Product('page-3-second', { resultPosition: 98 }),
  ]
  const { filterProducts } = runContentScript(
    products,
    'https://www.amazon.com/s?k=candle&page=3',
    { paginationContainers: [stalePagination.container, currentPagination.container] },
  )

  assert.strictEqual(filterProducts({}), true)
  assert.strictEqual(stalePagination.widget.removed, true)
  assert.strictEqual(currentPagination.widget.removed, false)
}

const testDefersFilteringUntilResultsMatchUrlPage = () => {
  const stalePagination = createPaginationContainer(1)
  const products = [
    new Product('page-1-first', { resultPosition: 1 }),
    new Product('page-1-second', { resultPosition: 2 }),
  ]
  const { filterProducts } = runContentScript(
    products,
    'https://www.amazon.com/s?k=candle&page=3',
    { paginationContainers: [stalePagination.container] },
  )

  assert.strictEqual(filterProducts({}), false)
  assert.strictEqual(stalePagination.widget.removed, false)
}

testMinimumReviewsCount()
testSortByUnitPriceToggle()
testSortByUnitPriceWithoutWrapper()
testPriceFallbackParsing()
testSortByModernUnitPriceMarkup()
testSortByBaseUnitPriceBeforeFullPrice()
testSortByUnitPriceNumberFormats()
testCustomFilterKeys()
testEmptySearchResults()
testRemovesStalePagination()
testDefersFilteringUntilResultsMatchUrlPage()

console.log('content script regression tests passed')
