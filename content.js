
const filtersFields = [
  { title: 'Minimal reviews count', name: 'minimumReviewsCount', type: 'number' },
  { title: 'Free delivery', name: 'freeDelivery', type: 'checkbox' },
  { title: 'Remove sponsored', name: 'removeSponsored', type: 'checkbox' },
  { title: 'Sort by unit price', name: 'sortByUnit', type: 'checkbox' },
  { title: 'Words should not be in the title:', name: 'negativeWords', type: 'textarea' },
  { title: 'Words should be present in the title:', name: 'positiveWords', type: 'textarea' },
]

let isStandardPriceBlockPresent

const fieldId = fieldName => `custom-amazon-filter-${fieldName}`

generateLabelBlock = (field, beforeLabel = '') => {
  return `
  <div class="a-section a-spacing-small">
    ${beforeLabel}
    <span class="a-size-base a-color-base puis-bold-weight-text">${field.title}</span>
  </div>`
}

const generateNumberInput = (field) => {
  return generateLabelBlock(field) + `<input type="number" value="0" id="${fieldId(field.name)}">`
}

const generateCheckbox = (field) => {
  return generateLabelBlock(field, `<input type="checkbox" id="${fieldId(field.name)}">`)
}

const generateTextarea = (field) => {
  return generateLabelBlock(field) + `<textarea id="${fieldId(field.name)}" rows="4" cols="10"></textarea>`
}

const generatePriceInput = (fieldName, placeholder) => {
  return `
  <span class="a-color-base s-ref-small-padding-left s-ref-price-currency">$</span>
  <input type="text" maxlength="9" id="${fieldId(fieldName)}" placeholder="${placeholder}" name="${fieldName}" class="a-input-text a-spacing-top-mini s-ref-price-range s-ref-price-padding">`
}

const generateField = field => {
  if (field.type === 'number')   return generateNumberInput(field)
  if (field.type === 'checkbox') return generateCheckbox(field)
  if (field.type === 'textarea') return generateTextarea(field)
  console.error(`Unknown field type: ${field.type}`)
}

const customPriceBlock =
  `<div id="custom-amazon-filter-by-price-block">` +
  generatePriceInput('low-price', 'Min') +
  generatePriceInput('high-price', 'Max') +
  `</div>`

const mySection =
  `<div id="custom-amazon-filters" class="a-section a-spacing-none">` +
  filtersFields.map(field => generateField(field)).join('\n') +
  customPriceBlock +
  `</div>`

const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const getReviewCount = product => {
  try {
    const el = product.querySelector('.a-size-small a .a-size-base')
    if (!el) return 0
    return +el.innerText.replaceAll(',', '').match(/(\d+)/)[0]
  }
  catch(err) {
    console.debug([err, product])
    return 0
  }
}

const getTitle = product => {
  return product.querySelector('h2').innerText.toLowerCase()
}

const getPrice = product => {
  try {
    const priceEl = product.querySelector('.a-price .a-offscreen')
    if (!priceEl) return null
    return +priceEl.innerText.match(/\d+\.\d+/)[0]
  }
  catch(err) {
    console.debug([err, product])
    return 0
  }
}

const getUnitPrice = product => {
  const priceEl = product.querySelector('.a-price .a-offscreen')
  const unitPriceEl = priceEl && priceEl.parentElement.parentElement.querySelector('.a-size-base.a-color-secondary')
  if (!unitPriceEl) return Infinity

  try {
    return +unitPriceEl.innerText.match(/\(.*?(\d+[\.,]+\d+)\//)[1]
  }
  catch(err) {
    console.debug([err, product])
    return Infinity
  }
}

const sortBy = (products, method, desc) => {
  return products.sort((a, b) => {
    const va = method(a)
    const vb = method(b)

    console.log([va, vb])

    if (va === vb) return 0
    if (va === null) return 1
    if (vb === null) return -1

    const diff = va - vb
    return desc ? -diff : diff
  })
}

const wordsFromTextArea = tag => {
  return tag.value.toLowerCase().
    split(/,|\n/).
    map(word => word.trim()).
    filter(word => word.length > 0)
}

const filterProducts = tags => {
  const filters = {}
  for (const field of filtersFields) {
    if (field.type === 'number') filters[field.name] = +tags[field.name].value
    else if (field.type === 'checkbox') filters[field.name] = tags[field.name].checked
    else if (field.type === 'textarea') filters[field.name] = wordsFromTextArea(tags[field.name])
    else console.error(`Unknown field type: ${field.type}`)
  }
  filters.minPrice            = +tags.minPrice.value
  filters.maxPrice            = +tags.maxPrice.value
  filters.order               = document.getElementById('s-result-sort-select').value

  saveFilters(filters)

  let products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  for (const product of products) {
    const reviewsCount = getReviewCount(product)
    const title        = getTitle(product)
    const price        = getPrice(product)
    const allText      = product.innerText.toLowerCase()
    const isSponsored  = !!product.querySelector('.puis-sponsored-label-text')

    let show =
      (reviewsCount >= filters.minimumReviewsCount) &&
      (filters.negativeWords.filter(word => title.includes(word)).length === 0) &&
      filters.positiveWords.every(word => title.includes(word)) &&
      (filters.minPrice == 0 || price !== null && price >= filters.minPrice) &&
      (filters.maxPrice == 0 || price !== null && price <= filters.maxPrice) &&
      (!filters.freeDelivery || allText.includes('free delivery')) &&
      !(filters.removeSponsored && isSponsored)
    elementToggle(product, show)
  }

  if (filters.sortByUnit || filters.order === 'price-asc-rank' || filters.order === 'price-desc-rank') {
    products = Array.from(products)
    if (filters.sortByUnit)                       products = sortBy(products, getUnitPrice)
    else if (filters.order === 'price-asc-rank')  products = sortBy(products, getPrice)
    else if (filters.order === 'price-desc-rank') products = sortBy(products, getPrice, true)

    const parent = products[0].parentElement
    parent.textContent = ''
    for (const product of products) {
      parent.appendChild(product)
    }
  }
}

const findPageId = _ => {
  const url = window.location.href
  const m = url.match(/&node=(\d+)/) || url.match(/rh=n%3A(\d+)/) || url.match(/ref=([a-zA-Z\-_\d]+)/)
  if (m) return m[1]
}

const FILTERS_KEY = 'CUSTOM_AMAZON_FILTERS_KEY'
const customFiltersKey = _ => {
  const id = findPageId()
  if (id) return FILTERS_KEY + '-' + id
}

const loadFilters = (tags) => {
  const key = customFiltersKey()
  if (!key) return

  const savedFilters = localStorage.getItem(key)
  if (!savedFilters) return

  const filters = JSON.parse(savedFilters)
  for (const key in tags) {
    if (filters[key] === undefined) continue
    // do not load min/max price if standard price block is present, it's contr-intuitive
    if (isStandardPriceBlockPresent && (key === 'minPrice' || key === 'maxPrice')) continue
    tags[key].value = filters[key]
  }
}

const saveFilters = (filters) => {
  const key = customFiltersKey()
  if (!key) return
  localStorage.setItem(key, JSON.stringify(filters))
}

const init = _ => {
  const filtersTag = document.querySelector('#s-refinements > .a-section')
  if (!filtersTag) return

  filtersTag.innerHTML = mySection + filtersTag.innerHTML

  const filterTags = {}
  for (const field of filtersFields) {
    filterTags[field.name] = document.getElementById(fieldId(field.name))
  }

  const customPriceBlock = document.getElementById('custom-amazon-filter-by-price-block')
  isStandardPriceBlockPresent = !!document.getElementById('low-price')
  if (isStandardPriceBlockPresent) {
    filterTags.minPrice = document.getElementById('low-price')
    filterTags.maxPrice = document.getElementById('high-price')
    elementToggle(customPriceBlock, false)
  } else {
    filterTags.minPrice = document.getElementById('custom-amazon-filter-low-price')
    filterTags.maxPrice = document.getElementById('custom-amazon-filter-high-price')
    elementToggle(customPriceBlock, true)
  }


  loadFilters(filterTags)
  filterProducts(filterTags)

  for (const key in filterTags) {
    filterTags[key].addEventListener('change', _ => filterProducts(filterTags))
  }

  // TODO: ugly hack to detect page change
  let currentUrl = window.location.href
  setInterval(function() {
    if (currentUrl != window.location.href) {
      currentUrl = window.location.href
      setTimeout(_ => { filterProducts(filterTags) }, 0)
      setTimeout(_ => { filterProducts(filterTags) }, 500)
      setTimeout(_ => { filterProducts(filterTags) }, 1000)
    }
  }, 500)
}

init()
