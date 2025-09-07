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
  console.debug('SEND MESSAGE:', type, payload)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type, payload }).then((response) => {
        console.debug('RECEIVE MESSAGE:', type, response)
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

    const form = document.getElementById('filtersForm')
    const notAllowedMessage = document.getElementById('not-allowed-message')

    notAllowedMessage.style.display = 'none'
    form.style.display = ''
    setGrayedIcon()

    filterProducts(state)
  })
}

const filterProducts = (state) => {
  if (!state.initialized) {
    return
  }
  
  sendMessageToCurrentTab('APPLY_FILTERS', getFilters(state.filterTags))
}

const setGrayedIcon = () => {
  chrome.action.setIcon({
    path: {
      "48": "images/icon-grey-48.png",
      "128": "images/icon-grey-128.png",
      "512": "images/icon-grey-512.png",
    },
  })
}

// const init = _ => {
//   chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//     const tab = tabs[0]
//     // const url = tab && tab.url
//     // const allowed = url && isAllowedAmazonUrl(url)
//     const form = document.getElementById('filtersForm')
//     const notAllowedMessage = document.getElementById('not-allowed-message')

//     // if (allowed) {
//       form.style.display = ''
//       notAllowedMessage.style.display = 'none'
//       const state = {
//         initialized: false,
//         filterTags:  {},
//       };
//       for (const field of filtersFields) {
//         state.filterTags[field.name] = document.getElementById(field.name)
//       }
//       loadFilters(state)
//       for (const key in state.filterTags) {
//         state.filterTags[key].addEventListener('change', _ => filterProducts(state))
//         state.filterTags[key].addEventListener('input',  _ => filterProducts(state))
//       }
//     } else {
//       form.style.display = 'none'
//       msg.style.display = ''
//       setGrayedIcon()
//     }
//   })

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
    state.filterTags[key].addEventListener('input',  _ => filterProducts(state))
  }
}

init()