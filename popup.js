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

const getCurrentTab = () => new Promise(resolve => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    resolve(tabs[0])
  })
})

const amazonHostPermissions = () => {
  return chrome.runtime.getManifest().host_permissions || []
}

const hostPermissionForUrl = (url) => {
  if (!url) {
    return null
  }

  try {
    const origin = new URL(url).origin

    return amazonHostPermissions().find(pattern => {
      return new URL(pattern.replace(/\*$/, '')).origin === origin
    }) || null
  } catch (err) {
    return null
  }
}

const sendMessageToTab = (tabId, type, payload = {}, callback = null) => {
  chrome.tabs.sendMessage(tabId, { type, payload }).then((response) => {
    if (callback) {
      callback(response)
    }
  }).catch(console.error)
}

const loadFilters = (state) => {
  if (state.initialized) {
    return
  }

  sendMessageToTab(state.tabId, 'LOAD_FILTERS', null, (response) => {
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

    state.initialized = true
    filterProducts(state)
  })
}

const filterProducts = (state) => {
  if (!state.initialized) {
    return
  }
  
  sendMessageToTab(state.tabId, 'APPLY_FILTERS', getFilters(state.filterTags))
}

const showPermissionRequest = (state, permissions) => {
  const statusMessage = document.getElementById('status-message')
  const grantButton = document.getElementById('grant-permission')

  statusMessage.textContent = 'Allow access to Amazon sites to apply filters automatically.'
  grantButton.style.display = ''

  grantButton.addEventListener('click', async () => {
    grantButton.disabled = true

    try {
      const granted = await chrome.permissions.request({ origins: permissions })
      if (!granted) {
        statusMessage.textContent = 'Amazon access was not granted.'
        grantButton.disabled = false
        return
      }

      chrome.tabs.reload(state.tabId, () => window.close())
    } catch (err) {
      console.error(err)
      statusMessage.textContent = 'Could not request Amazon access.'
      grantButton.disabled = false
    }
  })
}

const init = async _ => {
  const state = {
    initialized: false,
    filterTags:  {},
    tabId:       null,
  }

  for (const name of Object.keys(filtersFields)) {
    state.filterTags[name] = document.getElementById(name)
  }

  for (const key in state.filterTags) {
    state.filterTags[key].addEventListener('change', _ => filterProducts(state))
    state.filterTags[key].addEventListener('input',  _ => filterProducts(state))
  }

  const tab = await getCurrentTab()
  if (!hostPermissionForUrl(tab?.url)) {
    return
  }

  state.tabId = tab.id
  const permissions = amazonHostPermissions()
  const hasPermission = await chrome.permissions.contains({ origins: permissions })
  if (!hasPermission) {
    showPermissionRequest(state, permissions)
    return
  }

  loadFilters(state)
}

init()
