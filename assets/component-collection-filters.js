document.addEventListener('DOMContentLoaded', () => {
  const filterPanel = document.querySelector('[data-filter-panel]');
  const filterToggles = document.querySelectorAll('[data-filter-toggle]');
  filterToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!filterPanel) return;
      filterPanel.classList.toggle('is-open');
    });
  });

  const form = document.querySelector('form[id^="FacetFilterForm-"]');
  if (form) {
    form.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => form.requestSubmit());
    });
  }

  const sortSelect = document.querySelector('[data-sort-select]');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', sortSelect.value);
      window.location.href = url.toString();
    });
  }

  const grid = document.querySelector('[data-product-grid]');
  const gridToggle = document.querySelector('[data-grid-toggle]');
  if (grid && gridToggle) {
    const stored = localStorage.getItem('dew:grid-columns') || '4';
    applyColumns(stored);

    gridToggle.querySelectorAll('[data-grid-cols]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gridCols === stored);
      btn.addEventListener('click', () => {
        applyColumns(btn.dataset.gridCols);
        localStorage.setItem('dew:grid-columns', btn.dataset.gridCols);
        gridToggle.querySelectorAll('[data-grid-cols]').forEach((b) => b.classList.toggle('is-active', b === btn));
      });
    });
  }

  function applyColumns(count) {
    if (grid) grid.style.setProperty('--grid-columns', count);
  }
});
