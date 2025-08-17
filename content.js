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

// const findPageId = _ => {
//   const url = window.location.href
//   const m = url.match(/&crid=([A-Z0-9]+)/) || url.match(/&node=(\d+)/) || url.match(/rh=n%3A(\d+)/) || url.match(/k=([a-zA-Z\-\+_\d]+)/) || url.match(/ref=([a-zA-Z\-_\d]+)/)
//   if (m) return m[1]
// }

// const FILTERS_KEY = 'CUSTOM_AMAZON_FILTERS_KEY'
// const customFiltersKey = _ => {
//   const id = findPageId()
//   if (id) return FILTERS_KEY + '-' + id
// }

// const loadFilters = (tags) => {
//   const key = customFiltersKey()
//   if (!key) return

//   const savedFilters = localStorage.getItem(key)
//   if (!savedFilters) return

//   const filters = JSON.parse(savedFilters)
//   for (const key in tags) {
//     if (filters[key] === undefined) continue
//     // do not load min/max price if standard price block is present, it's contr-intuitive
//     if (isStandardPriceBlockPresent && (key === 'minPrice' || key === 'maxPrice')) continue
//     tags[key].value = filters[key]
//   }
// }

// const saveFilters = (filters) => {
//   const key = customFiltersKey()
//   if (!key) return
//   localStorage.setItem(key, JSON.stringify(filters))
// }

function filterProducts(filters) {
  let products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  products = Array.from(products)

  for (const product of products) {
    const data = productData(product)
    const show =
      (data.reviewsCount >= filters.minimumReviewsCount) &&
      (filters.negativeWords.filter(word => data.title.includes(word)).length === 0) &&
      filters.positiveWords.every(word => data.title.includes(word)) &&
      (filters.minPrice == 0 || data.price !== null && data.price >= filters.minPrice) &&
      (filters.maxPrice == 0 || data.price !== null && data.price <= filters.maxPrice) &&
      (!filters.freeDelivery || data.allText.includes('free delivery')) &&
      !(filters.removeSponsoredAndFeatured && data.isSponsored)
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'APPLY_FILTERS') {
    filterProducts(message.filters)
  }
})