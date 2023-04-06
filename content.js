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

const amazonFiltersTag = document.querySelector('#s-refinements > .a-section')
amazonFiltersTag.innerHTML = mySection + amazonFiltersTag.innerHTML

const amazonFilterTags = {}
amazonFilterTags.minimumReviewsCount = document.getElementById('custom-amazon-filter-minimal-reviews-count')
amazonFilterTags.negativeWords       = document.getElementById('custom-amazon-filter-negative-words')
amazonFilterTags.minPrice            = document.getElementById('low-price')
amazonFilterTags.maxPrice            = document.getElementById('high-price')

const elementToggle = (element, show) => {
  element.style.display = show ? 'block' : 'none'
}

const filterProducts = _ => {
  const amazonFilters = {}
  amazonFilters.minimumReviewsCount = +amazonFilterTags.minimumReviewsCount.value
  amazonFilters.negativeWords       = amazonFilterTags.negativeWords.value.split(/,|\n/).map(word => word.trim())
  amazonFilters.minPrice            = +amazonFilterTags.minPrice.value
  amazonFilters.maxPrice            = +amazonFilterTags.maxPrice.value

  const products = document.querySelectorAll('.s-search-results [data-component-type="s-search-result"]')
  for (const product of products) {
    const reviewsCount = +product.querySelector('.a-size-small a .a-size-base').innerText.match(/(\d+)/)[0]
    // const reviewsCount = product.querySelector('.a-size-small .a-size-base').innerText
    // const negativeWords = amazonFilterTags.negativeWords.value.split(',')
    // const negativeWordsFound = negativeWords.filter(word => product.innerText.includes(word)).length > 0
    // const minPrice = amazonFilterTags.minPrice.value
    // const maxPrice = amazonFilterTags.maxPrice.value
    // const price = product.querySelector('.a-price-whole').innerText
    // const show = reviewsCount >= amazonFilterTags.minimumReviewsCount.value && !negativeWordsFound && price >= minPrice && price <= maxPrice
    let show = (reviewsCount >= amazonFilters.minimumReviewsCount) && true
    elementToggle(product, show)
  }
}

for (const key in amazonFilterTags) {
  amazonFilterTags[key].addEventListener('change', filterProducts)
}
