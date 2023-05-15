const mySection = `
<div id="custom-amazon-filters" class="a-section a-spacing-none">
  <div id="p_85-title" class="a-section a-spacing-small">
    <span class="a-size-base a-color-base puis-bold-weight-text">Minimal reviews count</span>
  </div>
  <span>
    <input type="number" value="0" id="custom-amazon-filter-minimal-reviews-count">
  </span>
  <div id="p_85-title" class="a-section a-spacing-small">
    <span class="a-size-base a-color-base puis-bold-weight-text">Negative words</span>
  </div>
  <span>
    <textarea id="custom-amazon-filter-negative-words" rows="4" cols="10"></textarea>
  </span>
</div>
`

const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const getReviewCount = product => {
  window.product = product
  return +product.querySelector('.a-size-small a .a-size-base').innerText.replaceAll(',', '').match(/(\d+)/)[0]
}

const getTitle = product => {
  window.product = product
  return product.querySelector('h2').innerText.toLowerCase()
}

const getPrice = product => {
  window.product = product
  return +product.querySelector('.a-price .a-offscreen').innerText.match(/\d+\.\d+/)[0]
}

const filterProducts = tags => {
  const filters = {}
  filters.minimumReviewsCount = +tags.minimumReviewsCount.value
  filters.negativeWords       = tags.negativeWords.value.toLowerCase().split(/,|\n/).map(word => word.trim()).filter(word => word.length > 0)
  filters.minPrice            = +tags.minPrice.value
  filters.maxPrice            = +tags.maxPrice.value

  saveFilters(filters)

  const products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  for (const product of products) {
    const reviewsCount = getReviewCount(product)
    const title        = getTitle(product)
    const price        = getPrice(product)

    console.debug({reviewsCount, title, price})

    let show =
      (reviewsCount >= filters.minimumReviewsCount) &&
      (filters.negativeWords.filter(word => title.includes(word)).length === 0) &&
      (filters.minPrice == 0 || price >= filters.minPrice) &&
      (filters.maxPrice == 0 || price <= filters.maxPrice)
    elementToggle(product, show)
  }
}

const findPageId = _ => {
  const url = window.location.href
  const m = url.match(/&node=(\d+)/) || url.match(/rh=n%3A(\d+)/)
  return m ? +m[1] : 0
}

const FILTERS_KEY = 'CUSTOM_AMAZON_FILTERS_KEY'
const customFiltersKey = _ => FILTERS_KEY + '-' + findPageId()

const loadFilters = (tags) => {
  const savedFilters = localStorage.getItem(customFiltersKey())
  if (savedFilters) {
    const filters = JSON.parse(savedFilters)
    for (const key in tags) {
      tags[key].value = filters[key]
    }
  }
}

const saveFilters = (filters) => {
  localStorage.setItem(customFiltersKey(), JSON.stringify(filters))
}

const init = _ => {
  const filtersTag = document.querySelector('#s-refinements > .a-section')
  if (!filtersTag) return

  filtersTag.innerHTML = mySection + filtersTag.innerHTML

  const filterTags = {}
  filterTags.minimumReviewsCount = document.getElementById('custom-amazon-filter-minimal-reviews-count')
  filterTags.negativeWords       = document.getElementById('custom-amazon-filter-negative-words')
  filterTags.minPrice            = document.getElementById('low-price')
  filterTags.maxPrice            = document.getElementById('high-price')

  loadFilters(filterTags)
  filterProducts(filterTags)

  for (const key in filterTags) {
    filterTags[key].addEventListener('change', _ => filterProducts(filterTags))
  }
}

init()
