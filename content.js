const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const getReviewCount = product => {
  try {
    const el =
      product.querySelector('.alf-search-csa-instrumentation-wrapper[data-csa-c-slot-id="alf-reviews"]') ||
      product.querySelector('.a-size-small a .a-size-base')
    if (!el) return 0
    const text = el.innerText.replaceAll(',', '').match(/[\d\.]+[kK]?/)[0]
    if (text.endsWith("k") || text.endsWith("K")) {
      return +text.match(/[\d\.]+/)[0] * 1000
    }
    else return +text
  }
  catch(err) {
    console.debug([err, product])
    return 0
  }
}

const getTitle = product => {
  return Array.from(product.querySelectorAll('h2')).map(elem => elem.innerText.toLowerCase()).join(' ')
}

const getPrice = product => {
  try {
    const priceEl = product.querySelector('.a-price .a-offscreen')
    if (!priceEl) return Infinity
    return +priceEl.innerText.replaceAll(',', '').match(/\d+\.\d+/)[0]
  }
  catch(err) {
    console.debug([err, product])
    return Infinity
  }
}

const getUnitPrice = product => {
  const priceEl = product.querySelector('.a-price .a-offscreen')
  const unitPriceEl = priceEl && priceEl.parentElement.parentElement.querySelector('.a-size-base.a-color-secondary')
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
    isSponsored:  !!product.querySelector('.puis-sponsored-label-text'),
  }
}

const LOCATION_REGEXPS = [
  /&crid=([A-Z0-9]+)/,
  /&node=(\d+)/,
  /rh=n%3A(\d+)/,
  /k=([a-zA-Z\-\+_\d]+)/,
  /ref=([a-zA-Z\-_\d]+)/,
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
  if (keys.length === 0) return

  for (const key of keys) {
    const savedFilters = localStorage.getItem(key)
    if (!savedFilters) continue

    console.debug('savedFilters:', savedFilters)

    try {
      filters = JSON.parse(savedFilters)
      filterProducts(filters)
      return filters
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }
  return filters
}

const saveFilters = (filters) => {
  const keys = customFiltersKeys()
  if (keys.length === 0) return
  for (const key of keys) {
    localStorage.setItem(key, JSON.stringify(filters))
  }
}

const filterByMinimumReviewsCount = (product, filters) => 
  product.reviewsCount >= filters.minimumReviewsCount

const filterByNegativeWords = (product, filters) => 
  filters.negativeWords.filter(word => product.title.includes(word)).length === 0

const filterByPositiveWords = (product, filters) => 
  filters.positiveWords.every(word => product.title.includes(word))

const filterByMaxPrice = (product, filters) => 
  filters.minPrice == 0 || product.price !== null && product.price <= filters.maxPrice

const filterByMinPrice = (product, filters) => 
  filters.minPrice == 0 || product.price !== null && product.price >= filters.minPrice

const filterByFreeDelivery = (product, filters) => 
  filters.freeDelivery === false || product.allText.includes('free delivery')

const filterBySponsoredAndFeatured = (product, filters) =>
  filters.removeSponsoredAndFeatured === false || product.isSponsored

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
  const pagination = document.querySelector('.s-pagination-container').parentElement

  let products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  products = Array.from(products)

  for (const product of products) {
    const data = productData(product)
    const show = FILTER_METHODS.every(([key, method]) => !Object.hasOwn(filters, key) || method(data, filters))
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
  }

  for (const product of products) {
    mainParent.appendChild(product)
  }

  // Sometimes pagination got accidentally removed
  if (!document.body.contains(pagination)) {
    mainParent.appendChild(pagination)
  }

  const extraProductSections = []
  const extraProductSectionTitleIds = [
    'loom-desktop-bottom-slot_featuredasins-heading',
    'loom-desktop-inline-slot_featuredasins-heading',
  ]
  for (const elementId of extraProductSectionTitleIds) {
    try {
      const titleEl = document.getElementById(elementId)
      const parent = titleEl.closest('.s-widget-container')
      if (parent) {
        extraProductSections.push(parent)
      }
    } catch (err) { }
  }
  
  for (const element of extraProductSections) {
    elementToggle(element, filters.removeSponsoredAndFeatured)
  }
}

const init = _ => {
  let filters = {}

  const reloadFilters = _ => {
    filters = loadFilters()
    filterProducts(filters)
  }

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    const { type, payload } = message
    console.debug('CLIENT RECEIVE MESSAGE:', type, payload)
    if (type === 'APPLY_FILTERS') {
      saveFilters(filters)
      filterProducts(payload)
    } else if (type === 'LOAD_FILTERS') {
      return Promise.resolve({ filters: filters })
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