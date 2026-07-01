const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const PRODUCT_INDEX_ATTR = 'data-better-amazon-product-index'
const SELECTORS = {
  searchResult: '.s-search-results [data-component-type="s-search-result"]',
  pagination: '.s-pagination-container',
  reviewCount: [
    '.alf-search-csa-instrumentation-wrapper[data-csa-c-slot-id="alf-reviews"]',
    '[data-cy="reviews-block"] a[href*="#customerReviews"]',
    '.a-size-small a .a-size-base',
  ],
  price: '.a-price .a-offscreen',
  sponsoredLabel: '.puis-sponsored-label-text',
  title: 'h2',
  unitPrice: '.a-size-base.a-color-secondary',
}
const FEATURED_SECTION_TITLE_IDS = [
  'loom-desktop-bottom-slot_featuredasins-heading',
  'loom-desktop-inline-slot_featuredasins-heading',
]
let nextProductIndex = 0

const assignProductIndexes = products => {
  for (const product of products) {
    if (!product.hasAttribute(PRODUCT_INDEX_ATTR)) {
      product.setAttribute(PRODUCT_INDEX_ATTR, nextProductIndex)
      nextProductIndex += 1
    }
  }
}

const getProductIndex = product => {
  return +product.getAttribute(PRODUCT_INDEX_ATTR)
}

const parseReviewCount = text => {
  const match = text.replaceAll(',', '').match(/[\d\.]+[kK]?/)
  if (!match) return 0

  const count = +match[0].match(/[\d\.]+/)[0]
  return match[0].endsWith('k') || match[0].endsWith('K') ? count * 1000 : count
}

const getReviewCount = product => {
  try {
    const el = SELECTORS.reviewCount.
      map(selector => product.querySelector(selector)).
      find(element => element)
    if (!el) return 0
    return parseReviewCount(`${el.getAttribute?.('aria-label') || ''} ${el.innerText}`)
  }
  catch(err) {
    console.debug([err, product])
    return 0
  }
}

const getTitle = product => {
  return Array.from(product.querySelectorAll(SELECTORS.title)).map(elem => elem.innerText.toLowerCase()).join(' ')
}

const getPrice = product => {
  try {
    const priceEl = product.querySelector(SELECTORS.price)
    if (!priceEl) return Infinity
    return +priceEl.innerText.replaceAll(',', '').match(/\d+\.\d+/)[0]
  }
  catch(err) {
    console.debug([err, product])
    return Infinity
  }
}

const getUnitPrice = product => {
  const priceEl = product.querySelector(SELECTORS.price)
  const unitPriceEl = priceEl && priceEl.parentElement.parentElement.querySelector(SELECTORS.unitPrice)
  if (!unitPriceEl) return getPrice(product)

  try {
    const text  = unitPriceEl.innerText
    const match = text.match(/\(.*?(\d+[\.,]+\d+)\//) || text.match(/\.*?(\d+[\.,]+\d+)/)
    return +match[1]
  }
  catch(err) {
    console.debug([err, product])
    return getPrice(product)
  }
}

const sortBy = (products, method, desc) => {
  return products.sort((a, b) => {
    const va = method(a)
    const vb = method(b)

    if (va === vb) return 0
    if (va === null) return 1
    if (vb === null) return -1

    const diff = va - vb
    return desc ? -diff : diff
  })
}

const productData = product => {
  return {
    reviewsCount: getReviewCount(product),
    title:        getTitle(product),
    price:        getPrice(product),
    allText:      product.innerText.toLowerCase(),
    isSponsored:  !!product.querySelector(SELECTORS.sponsoredLabel),
  }
}

const LOCATION_REGEXPS = [
  /&crid=([A-Z0-9]+)/,
  /&node=(\d+)/,
  /rh=n%3A(\d+)/,
  /k=([a-zA-Z\-\+_\d]+)/,
]

const findPageIds = _ => {
  const url = window.location.href
  return LOCATION_REGEXPS.
    map(regex => url.match(regex)).
    filter(m => m).
    map(m => m[1]).
    filter(str => str)
}

const FILTERS_KEY = 'CUSTOM_AMAZON_FILTERS_KEY'
const customFiltersKeys = _ => {
  const ids = findPageIds()
  return ids.map(id => FILTERS_KEY + '-' + id)
}

const loadFilters = () => {
  let filters = {}
  const keys = customFiltersKeys()

  for (const key of keys) {
    const savedFilters = localStorage.getItem(key)
    if (!savedFilters) continue

    try {
      filters = JSON.parse(savedFilters)
      filterProducts(filters)
      return filters
    } catch (err) {
      console.error('Failed to load filters:', key, err)
    }
  }
  
  return filters
}

const saveFilters = (filters) => {
  const keys = customFiltersKeys()
  for (const key of keys) {
    localStorage.setItem(key, JSON.stringify(filters))
  }
}

const filterByMinimumReviewsCount = (product, filter) => 
  product.reviewsCount >= filter

const filterByNegativeWords = (product, filter) => 
  filter.filter(word => product.title.includes(word)).length === 0

const filterByPositiveWords = (product, filter) => 
  filter.every(word => product.title.includes(word))

const filterByMaxPrice = (product, filter) => 
  filter == 0 || product.price !== null && product.price <= filter

const filterByMinPrice = (product, filter) => 
  filter == 0 || product.price !== null && product.price >= filter

const filterByFreeDelivery = (product, filter) => 
  filter === false || product.allText.includes('free delivery')

const filterBySponsoredAndFeatured = (product, filter) =>
  filter === false || !product.isSponsored

const FILTER_METHODS = [
  ['minimumReviewsCount',        filterByMinimumReviewsCount],
  ['negativeWords',              filterByNegativeWords],
  ['positiveWords',              filterByPositiveWords],
  ['maxPrice',                   filterByMaxPrice],
  ['minPrice',                   filterByMinPrice],
  ['freeDelivery',               filterByFreeDelivery],
  ['removeSponsoredAndFeatured', filterBySponsoredAndFeatured],
]

function filterProducts(filters) {
  const pagination = document.querySelector(SELECTORS.pagination)?.parentElement

  let products = document.querySelectorAll(SELECTORS.searchResult)
  products = Array.from(products)
  assignProductIndexes(products)

  for (const product of products) {
    const data = productData(product)
    const show = FILTER_METHODS.every(([key, method]) => !Object.hasOwn(filters, key) || method(data, filters[key]))
    elementToggle(product, show)
  }

  // Sometimes elements are in different blocks
  let parents = products.map(product => product.parentElement)
  const mainParent = parents[0]
  parents = [...new Set(parents)]
  for (const parent of parents) {
    parent.textContent = ''
  }

  if (filters.sortByUnitPrice) {
    products = sortBy(products, getUnitPrice)
  } else {
    products = sortBy(products, getProductIndex)
  }

  for (const product of products) {
    mainParent.appendChild(product)
  }

  // Sometimes pagination got accidentally removed
  if (pagination && !document.body.contains(pagination)) {
    mainParent.appendChild(pagination)
  }

  const extraProductSections = []
  for (const elementId of FEATURED_SECTION_TITLE_IDS) {
    try {
      const titleEl = document.getElementById(elementId)
      const parent = titleEl.closest('.s-widget-container')
      if (parent) {
        extraProductSections.push(parent)
      }
    } catch (err) { }
  }
  
  for (const element of extraProductSections) {
    elementToggle(element, !filters.removeSponsoredAndFeatured)
  }
}

const init = _ => {
  const state = {
    filters: {},
  }

  const reloadFilters = _ => {
    state.filters = loadFilters()
    filterProducts(state.filters)
  }

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    const { type, payload } = message
    
    if (type === 'APPLY_FILTERS') {
      state.filters = payload
      saveFilters(state.filters)
      filterProducts(state.filters)
    } else if (type === 'LOAD_FILTERS') {
      return Promise.resolve({ filters: state.filters })
    }
  })

  // TODO: ugly hack to detect page change
  let currentUrl = window.location.href
  setInterval(function() {
    if (currentUrl != window.location.href) {
      currentUrl = window.location.href
      setTimeout(reloadFilters, 0)
      setTimeout(reloadFilters, 500)
      setTimeout(reloadFilters, 1000)
    }
  }, 500)

  reloadFilters()
}

init()
