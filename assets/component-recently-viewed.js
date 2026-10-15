(function () {
  const STORAGE_KEY = 'dew:recently-viewed';
  const MAX_ITEMS = 12;

  function getHandles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function trackCurrentProduct() {
    const meta = document.querySelector('[data-current-product-handle]');
    if (!meta) return;
    const handle = meta.dataset.currentProductHandle;
    let handles = getHandles().filter((h) => h !== handle);
    handles.unshift(handle);
    handles = handles.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function cardTemplate(product) {
    const variant = product.variants[0];
    const image = product.featured_image || (product.images && product.images[0]);
    return `
      <li>
        <div class="product-card">
          <a href="/products/${product.handle}" class="product-card__link">
            <span class="product-card__media">
              ${image ? `<img src="${image}" alt="${escapeHtml(product.title)}" class="product-card__image product-card__image--primary" loading="lazy" width="400">` : ''}
            </span>
            <span class="product-card__content">
              <span class="product-card__title">${escapeHtml(product.title)}</span>
              <span class="product-card__price">${formatMoney(variant.price)}</span>
            </span>
          </a>
        </div>
      </li>
    `;
  }

  function renderRecentlyViewed() {
    const section = document.querySelector('recently-viewed');
    if (!section) return;
    const exclude = section.dataset.exclude;
    const grid = section.querySelector('[data-recently-viewed-grid]');
    const handles = getHandles().filter((h) => h !== exclude).slice(0, 8);

    if (handles.length === 0) return;

    Promise.all(
      handles.map((handle) => fetch(`/products/${handle}.js`).then((res) => (res.ok ? res.json() : null)).catch(() => null))
    ).then((products) => {
      const valid = products.filter(Boolean);
      if (valid.length === 0) return;
      grid.innerHTML = valid.map(cardTemplate).join('');
      section.hidden = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      trackCurrentProduct();
      renderRecentlyViewed();
    });
  } else {
    trackCurrentProduct();
    renderRecentlyViewed();
  }
})();
