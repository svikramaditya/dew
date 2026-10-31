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

  const QUICK_VIEW_ICON = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12C2 12 5.5 5.5 12 5.5C18.5 5.5 22 12 22 12C22 12 18.5 18.5 12 18.5C5.5 18.5 2 12 2 12Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>';
  const CART_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="var(--icon-stroke-width)" d="M3.392 6.875h13.216v8.016c0 .567-.224 1.112-.624 1.513-.4.402-.941.627-1.506.627H5.522a2.13 2.13 0 0 1-1.506-.627 2.15 2.15 0 0 1-.624-1.513zM8.818 2.969h2.333c.618 0 1.211.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.313c0-.622.246-1.218.683-1.658a2.33 2.33 0 0 1 1.65-.686"/></svg>';

  function cardTemplate(product) {
    const variant = product.variants.find((v) => v.available) || product.variants[0];
    const image = product.featured_image || (product.images && product.images[0]);
    return `
      <li>
        <div class="product-card">
          <a href="/products/${product.handle}" class="product-card__link">
            <span class="product-card__media">
              ${image ? `<img src="${image}" alt="${escapeHtml(product.title)}" class="product-card__image product-card__image--primary" loading="lazy" width="400">` : ''}
              <span class="product-card__quick-actions">
                <button type="button" class="product-card__quick-action" data-quick-view="${product.handle}" aria-label="Quick view">
                  ${QUICK_VIEW_ICON}
                </button>
              </span>
              ${product.available ? `
                <button type="button" class="product-card__add" data-quick-add="${variant.id}">
                  Add to cart ${CART_ICON}
                </button>
              ` : ''}
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
