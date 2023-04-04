document.getElementById("apply-filters").addEventListener("click", () => {
  const negativeWords = document.getElementById("negative-words").value.split(",").map(word => word.trim());
  const minPrice = parseFloat(document.getElementById("min-price").value) || 0;
  const maxPrice = parseFloat(document.getElementById("max-price").value) || Number.MAX_VALUE;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, {
      action: "apply-filters",
      negativeWords: negativeWords,
      minPrice: minPrice,
      maxPrice: maxPrice
    });
  });

  window.close();
});
