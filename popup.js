// Handles filter UI and messaging to content.js
const form = document.getElementById('filtersForm');

// Load saved filters from chrome.storage
chrome.storage.local.get('amazonFilters', (data) => {
  if (data.amazonFilters) {
    Object.entries(data.amazonFilters).forEach(([key, value]) => {
      const el = form.elements[key];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value;
    });
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const filters = {};
  Array.from(form.elements).forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') filters[el.name] = el.checked;
    else if (el.type === 'textarea') filters[el.name] = el.value.trim();
    else filters[el.name] = el.value;
  });
  chrome.storage.local.set({ amazonFilters: filters }, () => {
    // Send filters to content.js in active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'APPLY_FILTERS', filters });
      }
    });
    window.close();
  });
});
