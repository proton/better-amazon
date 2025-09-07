const numberValue = {
  get: (tag) => +tag.value,
  set: (tag, val) => { tag.value = val }
}

const checkboxValue = {
  get: (tag) => tag.checked,
  set: (tag, val) => { tag.checked = val }
}

const textTagsValue = {
  get: (tag) => wordsFromTextArea(tag),
  set: (tag, val) => { tag.value = val.join(', ') }
}

const filtersFields = {
  minimumReviewsCount:        numberValue,
  freeDelivery:               checkboxValue,
  removeSponsoredAndFeatured: checkboxValue,
  sortByUnitPrice:            checkboxValue,
  negativeWords:              textTagsValue,
  positiveWords:              textTagsValue,
  minPrice:                   numberValue,
  maxPrice:                   numberValue,
}

const wordsFromTextArea = tag => {
  return tag.value.toLowerCase().
    split(/,|\n/).
    map(word => word.trim()).
    filter(word => word.length > 0)
}

const getFilters = (tags) => {
  const filters = {}

  for (const [name, { get }] of Object.entries(filtersFields)) {
    filters[name] = get(tags[name])
  }

  return filters
}

const sendMessageToCurrentTab = (type, payload = {}, callback = null) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type, payload }).then((response) => {
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
        filtersFields[key].set(state.filterTags[key], value)
      }
    })

    const form = document.getElementById('filtersForm')
    const notAllowedMessage = document.getElementById('not-allowed-message')

    notAllowedMessage.style.display = 'none'
    form.style.display = ''
    setIcon(false)

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

const setIcon = (isGrayed) => {
  const iconSizes = [48, 128, 512]
  const colorSuffix = isGrayed ? 'grey-' : ''

  chrome.action.setIcon({
    path: iconSizes.reduce((acc, size) => {
      acc[size] = `images/icon-${colorSuffix}${size}.png`
      return acc
    }, {})
  })
}

const init = _ => {
  setIcon(true)

  const state = {
    initialized: false,
    filterTags:  {},
  }

  for (const name of Object.keys(filtersFields)) {
    state.filterTags[name] = document.getElementById(name)
  }

  loadFilters(state)

  for (const key in state.filterTags) {
    state.filterTags[key].addEventListener('change', _ => filterProducts(state))
    state.filterTags[key].addEventListener('input',  _ => filterProducts(state))
  }
}

init()