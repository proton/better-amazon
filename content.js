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

const filterProducts = _ => {
  const filters = {}
  filters.minimumReviewsCount = +amazonFilterTags.minimumReviewsCount.value
  filters.negativeWords       = amazonFilterTags.negativeWords.value.split(/,|\n/).map(word => word.trim())
  filters.minPrice            = +amazonFilterTags.minPrice.value
  filters.maxPrice            = +amazonFilterTags.maxPrice.value

  saveFilters(filters)

  const products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  for (const product of products) {
    const reviewsCount = +product.querySelector('.a-size-small a .a-size-base').innerText.match(/(\d+)/)[0]
    const title        = product.querySelector('h2').innerText
    const price        = +product.querySelector('.a-price .a-offscreen').innerText.match(/\d+\.\d+/)[0]

    let show = (reviewsCount >= amazonFilters.minimumReviewsCount) && (filters.negativeWords.filter(word => title.includes(word)).length === 0) && (filters.minPrice == 0 || price >= filters.minPrice) && (filters.maxPrice == 0 || price <= filters.maxPrice)
    elementToggle(product, show)
  }
}

const findPageId = _ => {
  const url = window.location.href
  const m = url.match(/&node=(\d+)/) || url.match(/rh=n%3A(\d+)/)
  return m ? +m[1] : 0
}

const customAmazonFiltersKey = _ => CUSTOM_AMAZON_FILTERS_KEY + '-' + findPageId()

const loadFilters = (tags) => {
  const savedFilters = localStorage.getItem(customAmazonFiltersKey)
  if (savedFilters) {
    const filters = JSON.parse(savedFilters)
    for (const key in tags) {
      tags[key].value = filters[key]
    }
  }
}

const saveFilters = (filters) => {
  localStorage.setItem(customAmazonFiltersKey(), JSON.stringify(filters))
}

const CUSTOM_AMAZON_FILTERS_KEY = 'CUSTOM_AMAZON_FILTERS_KEY'

const amazonFiltersTag = document.querySelector('#s-refinements > .a-section')
amazonFiltersTag.innerHTML = mySection + amazonFiltersTag.innerHTML

const amazonFilterTags = {}
amazonFilterTags.minimumReviewsCount = document.getElementById('custom-amazon-filter-minimal-reviews-count')
amazonFilterTags.negativeWords       = document.getElementById('custom-amazon-filter-negative-words')
amazonFilterTags.minPrice            = document.getElementById('low-price')
amazonFilterTags.maxPrice            = document.getElementById('high-price')

loadFilters(amazonFilterTags)
filterProducts()

for (const key in amazonFilterTags) {
  amazonFilterTags[key].addEventListener('change', filterProducts)
}
