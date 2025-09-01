const filtersFields = [
  { name: 'minimumReviewsCount',        value: (tag) => +tag.value },
  { name: 'freeDelivery',               value: (tag) => tag.checked },
  { name: 'removeSponsoredAndFeatured', value: (tag) => tag.checked },
  { name: 'sortByUnitPrice',            value: (tag) => tag.checked },
  { name: 'negativeWords',              value: (tag) => wordsFromTextArea(tag) },
  { name: 'positiveWords',              value: (tag) => wordsFromTextArea(tag) },
  { name: 'minPrice',                   value: (tag) => +tag.value },
  { name: 'maxPrice',                   value: (tag) => +tag.value },
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

const sendMessageToCurrentTab = (type, payload = {}, callback = null) => {
  console.log('SEND MESSAGE:', type, payload)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type, payload }).then((response) => {
        console.log('RECEIVE MESSAGE:', type, response)
        if (callback) {
          callback(response)
        }
      }).catch(console.error)
    }
  })
}

const loadFilters = (state) => {
  if (state.initialized) {
    return
  }

  sendMessageToCurrentTab('LOAD_FILTERS', null, (response) => {
    const filters = response.filters || {}
    Object.entries(filters).forEach(([key, value]) => {
      if (state.filterTags[key]) {
        state.filterTags[key].value = value
      }
    })

    state.initialized = true
    filterProducts(state)
  })
}

const filterProducts = (state) => {
  if (!state.initialized) {
    return
  }
  
  sendMessageToCurrentTab('APPLY_FILTERS', getFilters(state.filterTags))
}

const init = _ => {
  const state = {
    initialized: false,
    filterTags:  {},
  }

  for (const field of filtersFields) {
    state.filterTags[field.name] = document.getElementById(field.name)
  }

  loadFilters(state)

  for (const key in state.filterTags) {
    state.filterTags[key].addEventListener('change', _ => filterProducts(state))
  }

  // TODO: ugly hack to detect page change
  let currentUrl = window.location.href
  setInterval(function() {
    if (currentUrl != window.location.href) {
      currentUrl = window.location.href
      setTimeout(_ => { filterProducts(state) }, 0)
      setTimeout(_ => { filterProducts(state) }, 500)
      setTimeout(_ => { filterProducts(state) }, 1000)
    }
  }, 500)
}

init()