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

const amazonFilters = {}
amazonFilterTags.minimumReviewsCount = document.getElementById('custom-amazon-filter-minimal-reviews-count')
amazonFilterTags.negativeWords       = document.getElementById('custom-amazon-filter-negative-words')
amazonFilterTags.minPrice            = document.getElementById('low-price')
amazonFilterTags.minPrice            = document.getElementById('high-price')

//
