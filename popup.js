const filtersFields = [
  { name: 'minimumReviewsCount', value: (tag) => +tag.value },
  { name: 'freeDelivery',        value: (tag) => tag.checked },
  { name: 'removeSponsored',     value: (tag) => tag.checked },
  { name: 'sortByUnitPrice',     value: (tag) => tag.checked },
  { name: 'negativeWords',       value: (tag) => wordsFromTextArea(tag) },
  { name: 'positiveWords',       value: (tag) => wordsFromTextArea(tag) },
  { name: 'minPrice',            value: (tag) => +tag.value },
  { name: 'maxPrice',            value: (tag) => +tag.value },
]

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

  return filters
}

const filterProducts = tags => {
  const filters = getFilters(tags)
  // chrome.storage.local.set({ amazonFilters: filters }, () => {
    // Send filters to content.js in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log(['APPLY', tabs])
      const tab = tabs[0]
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'APPLY_FILTERS', filters });
      }
    })
  // })
}

const init = _ => {
  // const form = document.getElementById('filtersForm')

  const filterTags = {}
  for (const field of filtersFields) {
    filterTags[field.name] = document.getElementById(field.name)
  }

  // loadFilters(filterTags)
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


  // form.addEventListener('submit', (e) => {
  //   e.preventDefault()
  //   // const filters = {}
  //   // Array.from(form.elements).forEach(el => {
  //   //   console.log()
  //   //   if (!el.name) return;
  //   //   if (el.type === 'checkbox') filters[el.name] = el.checked;
  //   //   else if (el.type === 'textarea') filters[el.name] = el.value.trim();
  //   //   else filters[el.name] = el.value;
  //   // });
  //   // chrome.storage.local.set({ amazonFilters: filters }, () => {
  //   //   // Send filters to content.js in active tab
  //   //   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  //   //     if (tabs[0]) {
  //   //       chrome.tabs.sendMessage(tabs[0].id, { type: 'APPLY_FILTERS', filters })
  //   //     }
  //   //   });
  //   //   window.close()
  //   // })
  // })
}

init()