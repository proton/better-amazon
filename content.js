
const filtersFields = [
  { title: 'Minimal reviews count',                 name: 'minimumReviewsCount', type: 'number',   value: (tag) => +tag.value },
  { title: 'Free delivery',                         name: 'freeDelivery',        type: 'checkbox', value: (tag) => tag.checked },
  { title: 'Remove sponsored',                      name: 'removeSponsored',     type: 'checkbox', value: (tag) => tag.checked },
  { title: 'Sort by unit price',                    name: 'sortByUnit',          type: 'checkbox', value: (tag) => tag.checked },
  { title: 'Words should not be in the title:',     name: 'negativeWords',       type: 'textarea', value: (tag) => wordsFromTextArea(tag) },
  { title: 'Words should be present in the title:', name: 'positiveWords',       type: 'textarea', value: (tag) => wordsFromTextArea(tag) },
]

// filters.minPrice            = +tags.minPrice.value
// filters.maxPrice            = +tags.maxPrice.value
// filters.order               = document.getElementById('s-result-sort-select').value

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
  <input type="text" maxlength="9" id="${fieldId(fieldName)}" placeholder="${placeholder}" name="${fieldName}" class="a-input-text a-spacing-top-mini s-ref-price-range s-ref-price-padding" style="max-width: 90%">`
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
  `</div>`

const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const getReviewCount = product => {
  try {
    const el = product.querySelector('.a-size-small a .a-size-base')
    if (!el) return 0
    const text = el.innerText.replaceAll(',', '').match(/\d+k?/)[0]
    if (text.endsWith("k")) {
      return +text.match(/\d+/)[0] * 1000
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
    if (!priceEl) return null
    return +priceEl.innerText.replaceAll(',', '').match(/\d+\.\d+/)[0]
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

const getFilters = (tags) => {
  const filters = {}

  for (const field of filtersFields) {
    filters[field.name] = field.value(tags[field.name])
  }

  // TODO: put this to filtersFields:
  filters.minPrice = +tags.minPrice.value
  filters.maxPrice = +tags.maxPrice.value
  filters.order    = document.getElementById('s-result-sort-select').value

  return filters
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

const filterProducts = tags => {
  const filters = getFilters(tags)

  let products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  for (const product of products) {
    const data = productData(product)

    const show =
      (data.reviewsCount >= filters.minimumReviewsCount) &&
      (filters.negativeWords.filter(word => data.title.includes(word)).length === 0) &&
      filters.positiveWords.every(word => data.title.includes(word)) &&
      (filters.minPrice == 0 || data.price !== null && data.price >= filters.minPrice) &&
      (filters.maxPrice == 0 || data.price !== null && data.price <= filters.maxPrice) &&
      (!filters.freeDelivery || data.allText.includes('free delivery')) &&
      !(filters.removeSponsored && data.isSponsored)

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

const lazySetValue = (tag, value) => {
  if (tag.value !== value) tag.value = value
}

const init = _ => {
  const filtersTag = document.querySelector('#s-refinements > .a-section')
  if (!filtersTag) return

  filtersTag.innerHTML = mySection + filtersTag.innerHTML
  const mySectionTag = document.getElementById('custom-amazon-filters')

  const filterTags = {}

  isStandardPriceBlockPresent = !!document.getElementById('low-price')
  isRangePriceBlockPresent    = !!document.getElementById('p_36/range-slider_slider-item_lower-bound-slider')
  if (isStandardPriceBlockPresent) {
    filterTags.minPrice = document.getElementById('low-price')
    filterTags.maxPrice = document.getElementById('high-price')
  } else if (isRangePriceBlockPresent) {
    filterTags.minPrice = document.getElementsByName('low-price')[0]
    filterTags.maxPrice = document.getElementsByName('high-price')[0]

    const sliderArea = document.getElementById('p_36/range-slider')
    sliderArea.insertAdjacentHTML('beforeend', customPriceBlock)
    const myMinPriceTag = document.getElementById('custom-amazon-filter-low-price')
    const myMaxPriceTag = document.getElementById('custom-amazon-filter-high-price')

    const pairs = [
      [filterTags.minPrice, myMinPriceTag],
      [filterTags.maxPrice, myMaxPriceTag],
    ]

    for (const [rangeTag, textTag] of pairs) {
      textTag.value = rangeTag.value
      rangeTag.addEventListener('change', _ => lazySetValue(textTag, rangeTag.value))
      textTag.addEventListener('change',  _ => lazySetValue(rangeTag, textTag.value))
    }
  } else {
    filterTags.minPrice = document.getElementById('custom-amazon-filter-low-price')
    filterTags.maxPrice = document.getElementById('custom-amazon-filter-high-price')
    mySectionTag.insertAdjacentHTML('beforeend', customPriceBlock)
  }

  for (const field of filtersFields) {
    filterTags[field.name] = document.getElementById(fieldId(field.name))
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
