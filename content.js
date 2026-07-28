const elementToggle = (element, show) => {
  element.style.display = show ? '' : 'none'
}

const GRID_STYLE_ID = 'better-amazon-grid-style'
const GRID_CLASS = 'better-amazon-grid-results'
const PRODUCT_INDEX_ATTR = 'data-better-amazon-product-index'
// Amazon search result positions continue across pages: page 3 starts at 97
// for a 48-result page, even when the visible card data-index restarts.
const RESULTS_PER_PAGE = 48
const SELECTORS = {
  searchResultsSlot: '.s-main-slot.s-search-results',
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
  unitPrice: '.a-size-base.a-color-secondary',
}
const FEATURED_SECTION_TITLE_IDS = [
  'loom-desktop-bottom-slot_featuredasins-heading',
  'loom-desktop-inline-slot_featuredasins-heading',
]
let nextProductIndex = 0

const getSearchResultsSlot = () => document.querySelector(SELECTORS.searchResultsSlot)

const getProductListParent = products => products[0]?.parentElement || getSearchResultsSlot()

const RESULT_GRID_CSS = `
.s-main-slot.s-search-results.${GRID_CLASS},
.${GRID_CLASS} {
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)) !important;
  gap: 8px !important;
  align-items: stretch !important;
}

.${GRID_CLASS} > :not([data-component-type="s-search-result"]) {
  grid-column: 1 / -1 !important;
}

.s-main-slot.s-search-results.${GRID_CLASS} > [data-component-type="s-search-result"],
.${GRID_CLASS} > [data-component-type="s-search-result"] {
  grid-column: auto !important;
  width: auto !important;
  max-width: none !important;
  min-width: 0 !important;
  flex-basis: auto !important;
  flex: none !important;
  margin: 0 !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}

.${GRID_CLASS} > [data-component-type="s-search-result"] > .sg-col-inner,
.${GRID_CLASS} [data-cy="asin-faceout-container"] {
  height: 100% !important;
}

.${GRID_CLASS} [data-cy="asin-faceout-container"] {
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.${GRID_CLASS} .puis-card-container {
  margin: 0 !important;
}

.${GRID_CLASS} .puisg-row {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
}

.${GRID_CLASS} .puisg-row > .puisg-col {
  display: block !important;
  width: 100% !important;
  max-width: none !important;
  flex: none !important;
}

.${GRID_CLASS} [data-cy="image-container"] {
  width: 100% !important;
  min-width: 0 !important;
  padding: 0 !important;
}

.${GRID_CLASS} [data-cy="image-container"] .s-image-fixed-height,
.${GRID_CLASS} [data-cy="image-container"] .s-image-square-aspect {
  aspect-ratio: 1 / 1 !important;
  height: auto !important;
  max-height: none !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: #f7f7f7 !important;
}

.${GRID_CLASS} [data-cy="image-container"] img.s-image {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
}
`

const ensureGridStyles = () => {
  if (document.getElementById(GRID_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = GRID_STYLE_ID
  style.textContent = RESULT_GRID_CSS
  ;(document.head || document.documentElement).appendChild(style)
}

const applyGridLayout = parent => {
  ensureGridStyles()
  parent?.classList.add(GRID_CLASS)
}

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

const getUnitPrice = product => {
  const priceEl = product.querySelector(SELECTORS.price)
  const unitPriceEl = priceEl?.parentElement?.parentElement?.querySelector(SELECTORS.unitPrice)
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

const reorderProducts = (products, sortedProducts) => {
  const parent = getProductListParent(products)
  if (!parent) return

  const firstProductInParent = products.find(product => product.parentElement === parent)
  const anchorReference = firstProductInParent || parent.firstChild
  if (!anchorReference) {
    for (const product of sortedProducts) {
      parent.appendChild(product)
    }
    return
  }

  const anchor = document.createComment('better-amazon-products-start')
  parent.insertBefore(anchor, anchorReference)
  let insertAfter = anchor

  for (const product of sortedProducts) {
    const reference = insertAfter.nextSibling
    if (reference !== product) {
      parent.insertBefore(product, reference)
    }
    insertAfter = product
  }

  anchor.remove()
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

  let products = getSearchProducts()
  assignProductIndexes(products)
  if (products.length === 0) {
    return false
  }

  const productListParent = getProductListParent(products)
  applyGridLayout(productListParent)

  for (const product of products) {
    const data = productData(product)
    const show = FILTER_METHODS.every(([key, method]) => !Object.hasOwn(filters, key) || method(data, filters[key]))
    elementToggle(product, show)
  }

  const sortedProducts = filters.sortByUnitPrice
    ? sortBy(products, getUnitPrice)
    : sortBy(products, getProductIndex)

  reorderProducts(products, sortedProducts)

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
