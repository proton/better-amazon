const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const createClassList = owner => ({
  add: (...classNames) => {
    for (const className of classNames) {
      if (!owner.classNames.includes(className)) {
        owner.classNames.push(className)
      }
    }
  },
  contains: className => owner.classNames.includes(className),
})

const detachFromParent = child => {
  if (child.parentElement?.children) {
    child.parentElement.children = child.parentElement.children.filter(element => element !== child)
  }
}

const insertChild = (parent, child, reference = null) => {
  detachFromParent(child)

  const referenceIndex = reference ? parent.children.indexOf(reference) : -1
  if (referenceIndex === -1) {
    parent.children.push(child)
  } else {
    parent.children.splice(referenceIndex, 0, child)
  }
  child.parentElement = parent
}

const getNextSibling = element => {
  const siblings = element.parentElement?.children
  if (!siblings) return null

  const index = siblings.indexOf(element)
  return index === -1 ? null : siblings[index + 1] || null
}

class Element {
  constructor({ innerText = '', attributes = {}, querySelectors = {}, closestElement = null } = {}) {
    this.innerText = innerText
    this.attributes = attributes
    this.querySelectors = querySelectors
    this.closestElement = closestElement
    this.parentElement = null
    this.removed = false
    this.children = []
    this.style = {}
    this.classNames = []
    this.classList = createClassList(this)
  }

  getAttribute(name) {
    return this.attributes[name]
  }

  querySelector(selector) {
    return this.querySelectors[selector] || null
  }

  closest() {
    return this.closestElement
  }

  get firstChild() {
    return this.children[0] || null
  }

  get nextSibling() {
    return getNextSibling(this)
  }

  remove() {
    this.removed = true
    detachFromParent(this)
  }

  appendChild(child) {
    insertChild(this, child)
  }

  insertBefore(child, reference) {
    insertChild(this, child, reference)
  }
}

class Product {
  constructor(id, { price = null, priceText = null, reviewElements = {}, hasUnitPriceWrapper = true, resultPosition = null } = {}) {
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

  get nextSibling() {
    return getNextSibling(this)
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
    this.clearCount = 0
    this.classNames = []
    this.classList = createClassList(this)
    for (const child of children) {
      child.parentElement = this
    }
  }

  set textContent(_value) {
    this.clearCount += 1
    this.children = []
  }

  get firstChild() {
    return this.children[0] || null
  }

  appendChild(child) {
    insertChild(this, child)
  }

  insertBefore(child, reference) {
    insertChild(this, child, reference)
  }
}

const createPriceElement = ({ unitPrice, priceText, hasUnitPriceWrapper }) => {
  const unitPriceEl = new Element({ innerText: `($${unitPrice.toFixed(2)}/oz)` })
  const unitPriceParent = new Element({
    querySelectors: { '.a-size-base.a-color-secondary': unitPriceEl },
  })
  const priceWrapper = new Element()
  const priceEl = new Element({ innerText: priceText || '$10.00' })

  if (!hasUnitPriceWrapper) {
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

const runContentScript = (
  products,
  url = 'https://www.amazon.com.au/s?k=candle',
  { paginationContainers = [], productParents = null } = {},
) => {
  const parent = productParents?.[0] || new Parent(products)
  const searchParents = productParents || [parent]
  const head = new Element()
  const searchResultsSlot = parent
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
      documentElement: new Element(),
      head,
      createElement: () => new Element(),
      createComment: () => new Element(),
      getElementById: id => head.children.find(child => child.id === id) || null,
      querySelector: selector => {
        if (selector === '.s-main-slot.s-search-results') {
          return searchResultsSlot
        }

        return null
      },
      querySelectorAll: selector => {
        if (selector === '.s-search-results [data-component-type="s-search-result"]') {
          return searchParents.flatMap(parent => parent.children).filter(child => child instanceof Product)
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
    head,
    parent,
    searchResultsSlot,
    productParents: searchParents,
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
  assert.strictEqual(displays.legacy, '')
  assert.strictEqual(displays.au, '')
  assert.strictEqual(displays.low, 'none')
  assert.strictEqual(displays.missing, 'none')
}

const testAppliesGridLayoutOnce = () => {
  const product = new Product('product')
  const { filterProducts, head, searchResultsSlot } = runContentScript([product])

  filterProducts({})
  filterProducts({})

  assert.strictEqual(searchResultsSlot.classList.contains('better-amazon-grid-results'), true)
  assert.strictEqual(head.children.filter(child => child.id === 'better-amazon-grid-style').length, 1)
  assert.strictEqual(head.children[0].textContent.includes('minmax(285px, 1fr)'), true)
  assert.strictEqual(head.children[0].textContent.includes('grid-column: auto !important'), true)
  assert.strictEqual(head.children[0].textContent.includes('flex-basis: auto !important'), true)
}

const testSortByUnitPriceToggle = () => {
  const first = new Product('first', { price: 3 })
  const second = new Product('second', { price: 1 })
  const third = new Product('third', { price: 2 })
  const { parent, filterProducts } = runContentScript([first, second, third])

  filterProducts({ sortByUnitPrice: true })
  assert.deepStrictEqual(parent.children.map(product => product.id), ['second', 'third', 'first'])
  assert.strictEqual(parent.clearCount, 0)

  filterProducts({ sortByUnitPrice: false })
  assert.deepStrictEqual(parent.children.map(product => product.id), ['first', 'second', 'third'])
  assert.strictEqual(parent.clearCount, 0)
}

const testMovesProductsIntoSearchSlotParent = () => {
  const first = new Product('first')
  const second = new Product('second')
  const firstParent = new Parent([first])
  const secondParent = new Parent([second])
  const { filterProducts } = runContentScript(
    [],
    'https://www.amazon.com/s?k=type+c+to+type+a+adapter',
    { productParents: [firstParent, secondParent] },
  )

  filterProducts({})

  assert.deepStrictEqual(firstParent.children.map(product => product.id), ['first', 'second'])
  assert.deepStrictEqual(secondParent.children.map(product => product.id), [])
  assert.strictEqual(first.parentElement, firstParent)
  assert.strictEqual(second.parentElement, firstParent)
}

const testKeepsProductListAtOriginalPosition = () => {
  const header = new Element()
  header.id = 'header'
  const footer = new Element()
  footer.id = 'footer'
  const first = new Product('first', { price: 2 })
  const second = new Product('second', { price: 1 })
  const parent = new Parent([header, first, second, footer])
  const { filterProducts } = runContentScript(
    [],
    'https://www.amazon.com/s?k=type+c+to+type+a+adapter',
    { productParents: [parent] },
  )

  filterProducts({ sortByUnitPrice: true })

  assert.deepStrictEqual(parent.children.map(child => child.id), ['header', 'second', 'first', 'footer'])
  assert.strictEqual(parent.clearCount, 0)
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
testAppliesGridLayoutOnce()
testSortByUnitPriceToggle()
testMovesProductsIntoSearchSlotParent()
testKeepsProductListAtOriginalPosition()
testSortByUnitPriceWithoutWrapper()
testPriceFallbackParsing()
testCustomFilterKeys()
testEmptySearchResults()
testRemovesStalePagination()
testDefersFilteringUntilResultsMatchUrlPage()

console.log('content script regression tests passed')
