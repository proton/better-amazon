const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const PRODUCT_INDEX_ATTR = 'data-better-amazon-product-index'
// Amazon search result positions continue across pages: page 3 starts at 97
// for a 48-result page, even when the visible card data-index restarts.
const RESULTS_PER_PAGE = 48
const SELECTORS = {
  searchResult: '.s-search-results [data-component-type="s-search-result"]',
  pagination: '.s-pagination-container',
  paginationSelected: '.s-pagination-selected',
  paginationWidget: '[cel_widget_id*="PAGINATION"], [data-cel-widget*="PAGINATION"]',
  resultPosition: '[data-csa-c-pos]',
  searchResultWidget: '[cel_widget_id*="MAIN-SEARCH_RESULTS-"]',
  reviewCount: [
    '.alf-search-csa-instrumentation-wrapper[data-csa-c-slot-id="alf-reviews"]',
    '[data-cy="reviews-block"] a[href*="#customerReviews"]',
    '.a-size-small a .a-size-base',
  ],
  price: '.a-price .a-offscreen',
  sponsoredLabel: '.puis-sponsored-label-text',
  title: 'h2',
  unitPrice: [
    '.a-size-base.a-color-secondary',
    '.a-size-base.a-color-base',
    '.a-size-small.a-color-base',
  ],
}
const FEATURED_SECTION_TITLE_IDS = [
  'loom-desktop-bottom-slot_featuredasins-heading',
  'loom-desktop-inline-slot_featuredasins-heading',
]
let nextProductIndex = 0

const getSearchProducts = () => {
  return Array.from(document.querySelectorAll(SELECTORS.searchResult))
}

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

const getUrlPage = () => {
  try {
    return +(new URL(window.location.href).searchParams.get('page') || 1)
  } catch (_err) {
    return 1
  }
}

const getSelectedPaginationPage = (container = document) => {
  const selectedPage = container.querySelector(SELECTORS.paginationSelected)
  if (!selectedPage) return null

  const page = +selectedPage.innerText.trim()
  return Number.isFinite(page) ? page : null
}

const getResultPosition = product => {
  const csaPosition = product.querySelector(SELECTORS.resultPosition)?.getAttribute('data-csa-c-pos')
  if (csaPosition) {
    const position = +csaPosition
    if (Number.isFinite(position)) return position
  }

  const widgetId = product.querySelector(SELECTORS.searchResultWidget)?.getAttribute('cel_widget_id')
  const match = widgetId?.match(/MAIN-SEARCH_RESULTS-(\d+)/)
  return match ? +match[1] : null
}

const getResultPage = products => {
  const positions = Array.from(products).map(getResultPosition).filter(position => position !== null)
  if (positions.length === 0) return null

  return Math.floor((Math.min(...positions) - 1) / RESULTS_PER_PAGE) + 1
}

const getPaginationContainers = () => {
  // Amazon can leave stale pagination widgets in the result grid after SPA
  // navigation, so collect each whole pagination widget, not just the inner nav.
  return Array.from(document.querySelectorAll(SELECTORS.pagination)).
    map(container => container.closest(SELECTORS.paginationWidget) || container.parentElement).
    filter(container => container)
}

const getPaginationPage = container => {
  return getSelectedPaginationPage(container)
}

const findPaginationContainer = page => {
  const containers = getPaginationContainers()
  return containers.find(container => getPaginationPage(container) === page) || containers[containers.length - 1] || null
}

const removeStalePaginationContainers = page => {
  for (const container of getPaginationContainers()) {
    const paginationPage = getPaginationPage(container)
    if (paginationPage !== null && paginationPage !== page) {
      container.remove()
    }
  }
}

const isSearchPageReadyForFiltering = () => {
  const products = getSearchProducts()
  if (products.length === 0) return false

  const urlPage = getUrlPage()
  const resultPage = getResultPage(products)
  // Prefer product positions over pagination state because the stale paginator
  // is the failure mode: page-3 results can appear while page-1 pagination remains.
  if (resultPage !== null) return resultPage === urlPage

  const paginationPages = getPaginationContainers().map(getPaginationPage)
  return paginationPages.length === 0 || paginationPages.includes(urlPage)
}

const parseReviewCount = text => {
  const match = text.replaceAll(',', '').match(/[\d\.]+[kK]?/)
  if (!match) return 0

  const count = +match[0].match(/[\d\.]+/)[0]
  return match[0].endsWith('k') || match[0].endsWith('K') ? count * 1000 : count
}

const parsePrice = text => {
  const match = text.replaceAll(',', '').match(/\d+(?:\.\d+)?/)
  return match ? +match[0] : Infinity
}

const parseLocaleNumber = text => {
  const value = `${text}`.trim()
  const hasComma = value.includes(',')
  const hasDot = value.includes('.')
  let normalized = value

  if (hasComma && hasDot) {
    normalized = value.lastIndexOf(',') > value.lastIndexOf('.')
      ? value.replaceAll('.', '').replace(',', '.')
      : value.replaceAll(',', '')
  } else if (hasComma) {
    const parts = value.split(',')
    normalized = parts[parts.length - 1].length === 3
      ? value.replaceAll(',', '')
      : value.replace(',', '.')
  }

  const number = +normalized
  return Number.isFinite(number) ? number : null
}

const parseUnitPrice = text => {
  const match = `${text}`.match(/(\d[\d\.,]*)[^\d\/]*\//)
  return match ? parseLocaleNumber(match[1]) : null
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
    return parsePrice(priceEl.innerText)
  }
  catch(err) {
    console.debug([err, product])
    return Infinity
  }
}

const getSelectorElements = (container, selector) => {
  if (!container) return []

  if (typeof container.querySelectorAll === 'function') {
    const elements = Array.from(container.querySelectorAll(selector))
    if (elements.length > 0) return elements
  }

  const element = container.querySelector?.(selector)
  return element ? [element] : []
}

const getUnitPrice = product => {
  try {
    const priceEl = product.querySelector(SELECTORS.price)
    const priceContainer = priceEl?.parentElement?.parentElement
    const containers = [priceContainer, priceContainer?.parentElement, product].
      filter((container, index, all) => container && all.indexOf(container) === index)

    for (const container of containers) {
      for (const selector of SELECTORS.unitPrice) {
        for (const element of getSelectorElements(container, selector)) {
          const unitPrice = parseUnitPrice(element.innerText)
          if (unitPrice !== null) return unitPrice
        }
      }
    }

    return getPrice(product)
  }
  catch(err) {
    console.debug([err, product])
    return getPrice(product)
  }
}

const sortBy = (products, method, desc) => {
  return [...products].sort((a, b) => {
    const va = method(a)
    const vb = method(b)

    if (va === vb) return 0
    if (va === null) return 1
    if (vb === null) return -1

    const diff = va - vb
    return desc ? -diff : diff
  })
}

const sortByUnitPrice = products => {
  return [...products].sort((a, b) => {
    const unitPriceDiff = getUnitPrice(a) - getUnitPrice(b)
    if (unitPriceDiff !== 0) return unitPriceDiff

    const priceDiff = getPrice(a) - getPrice(b)
    if (priceDiff !== 0) return priceDiff

    return getProductIndex(a) - getProductIndex(b)
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

const FILTER_PAGE_PARAM_KEYS = ['crid', 'node', 'k']

const findPageIds = _ => {
  try {
    const url = new URL(window.location.href)
    const ids = FILTER_PAGE_PARAM_KEYS.
      map(key => url.searchParams.get(key)).
      filter(value => value)
    const nodeMatch = url.searchParams.get('rh')?.match(/(?:^|,)n:(\d+)/)

    if (nodeMatch) {
      ids.push(nodeMatch[1])
    }

    return ids
  } catch (err) {
    console.debug(['Failed to parse location:', err, window.location.href])
    return []
  }
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
  if (!isSearchPageReadyForFiltering()) return false

  const urlPage = getUrlPage()
  // Filtering below moves search result nodes around. Remove mismatched
  // pagination widgets first so a stale page-1 control is not preserved.
  removeStalePaginationContainers(urlPage)
  const pagination = findPaginationContainer(urlPage)

  let products = getSearchProducts()
  assignProductIndexes(products)
  if (products.length === 0) {
    return false
  }

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
    products = sortByUnitPrice(products)
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

  return true
}

const watchLocationChanges = callback => {
  let currentUrl = window.location.href
  const handleLocationChange = _ => {
    if (currentUrl === window.location.href) {
      return
    }

    currentUrl = window.location.href
    callback()
  }
  const wrapHistoryMethod = methodName => {
    const originalMethod = window.history?.[methodName]
    if (typeof originalMethod !== 'function') {
      return
    }

    window.history[methodName] = function(...args) {
      const result = originalMethod.apply(this, args)
      setTimeout(handleLocationChange, 0)
      return result
    }
  }

  wrapHistoryMethod('pushState')
  wrapHistoryMethod('replaceState')
  window.addEventListener?.('popstate', handleLocationChange)
  setInterval(handleLocationChange, 500)
}

const init = _ => {
  const state = {
    filters: {},
    reloadAttempt: 0,
  }

  const scheduleReloadFilters = (delay = 0) => {
    setTimeout(reloadFilters, delay)
  }

  const reloadFilters = _ => {
    state.filters = loadFilters()

    if (filterProducts(state.filters)) {
      state.reloadAttempt = 0
      return
    }

    state.reloadAttempt += 1
    if (state.reloadAttempt <= 20) {
      scheduleReloadFilters(250)
    }
  }

  const reloadFiltersWithRetries = _ => {
    state.reloadAttempt = 0
    // Give Amazon's SPA render a short head start; reloadFilters will keep
    // retrying until result positions or pagination match the new URL page.
    scheduleReloadFilters(250)
  }

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    const { type, payload } = message
    
    if (type === 'APPLY_FILTERS') {
      state.filters = payload
      saveFilters(state.filters)
      if (!filterProducts(state.filters)) {
        state.reloadAttempt = 0
        scheduleReloadFilters(250)
      }
    } else if (type === 'LOAD_FILTERS') {
      return Promise.resolve({ filters: state.filters })
    }
  })

  watchLocationChanges(reloadFiltersWithRetries)
  reloadFilters()
}

init()
