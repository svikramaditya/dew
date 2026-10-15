(function () {
  document.addEventListener('click', (event) => {
    const bundleAdd = event.target.closest('[data-bundle-add]');
    if (bundleAdd) {
      event.preventDefault();
      const ids = bundleAdd.dataset.bundleAdd.split(',').filter(Boolean);
      bundleAdd.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: ids.map((id) => ({ id, quantity: 1 })) }),
      })
        .then((res) => res.json())
        .then(() => {
          const drawer = document.querySelector('cart-drawer');
          if (drawer) {
            drawer.refresh();
            drawer.open();
          }
        })
        .finally(() => { bundleAdd.disabled = false; });
      return;
    }

    const quickAdd = event.target.closest('[data-quick-add]');
    if (quickAdd && !quickAdd.closest('.cart-drawer__recommendation')) {
      event.preventDefault();
      const id = quickAdd.dataset.quickAdd;
      const quantity = parseInt(quickAdd.dataset.quickAddQuantity, 10) || 1;
      quickAdd.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id, quantity }),
      })
        .then((res) => res.json())
        .then(() => {
          const drawer = document.querySelector('cart-drawer');
          if (drawer) {
            drawer.refresh();
            drawer.open();
          }
        })
        .finally(() => { quickAdd.disabled = false; });
      return;
    }

    const quickView = event.target.closest('[data-quick-view]');
    if (quickView) {
      event.preventDefault();
      openQuickView(quickView.dataset.quickView);
    }
  });

  let modal;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'quick-view-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="quick-view-modal__backdrop" data-quick-view-close></div>
      <div class="quick-view-modal__panel" role="dialog" aria-modal="true">
        <button type="button" class="quick-view-modal__close" data-quick-view-close aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none"><path d="M5 5L19 19M19 5L5 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <div class="quick-view-modal__body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-quick-view-close]').forEach((el) => {
      el.addEventListener('click', () => closeQuickView());
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && !modal.hidden) closeQuickView();
    });
    return modal;
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openQuickView(handle) {
    const el = ensureModal();
    const body = el.querySelector('.quick-view-modal__body');
    body.innerHTML = '<p>Loading…</p>';
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    document.documentElement.setAttribute('data-scroll-lock', '');

    fetch(`/products/${handle}.js`)
      .then((res) => res.json())
      .then((product) => renderQuickView(body, product))
      .catch(() => {
        body.innerHTML = '<p>Could not load this product.</p>';
      });
  }

  function renderQuickView(body, product) {
    const variants = product.variants;
    const firstAvailable = variants.find((v) => v.available) || variants[0];
    const image = product.featured_image || (product.images && product.images[0]);

    const optionsHtml = product.options_with_values.map((option, index) => {
      const hasSwatch = option.values.some((v) => v && typeof v === 'object' && v.swatch);
      // Shopify's /products/{handle}.js endpoint returns option values as plain
      // strings (no swatch data) -- swatches are only available through Liquid
      // on the real product page, so quick-view falls back to text pills here.
      const valuesHtml = option.values.map((value) => `
        <button type="button" class="product__option-value${value === firstAvailable['option' + (index + 1)] ? ' is-selected' : ''}"
          data-option-value data-option-position="${index + 1}" data-value="${escapeHtml(value)}">
          <span class="product__option-value-label">${escapeHtml(value)}</span>
        </button>
      `).join('');
      return `
        <div class="product__option" data-option-position="${index + 1}">
          <label class="product__label">${escapeHtml(option.name)}: <span data-selected-value>${escapeHtml(firstAvailable['option' + (index + 1)] || '')}</span></label>
          <div class="product__option-values">${valuesHtml}</div>
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="quick-view-modal__media">
        ${image ? `<img src="${image}" alt="${escapeHtml(product.title)}" width="600">` : ''}
      </div>
      <div class="quick-view-modal__info">
        <h2 class="quick-view-modal__title">${escapeHtml(product.title)}</h2>
        <p class="quick-view-modal__price" data-product-price>
          ${formatMoney(firstAvailable.price)}
        </p>
        <p>${product.description.replace(/<[^>]*>/g, '').slice(0, 160)}</p>
        ${product.has_only_default_variant ? '' : `<variant-picker class="product__options" data-product-json='${JSON.stringify(variants).replace(/'/g, '&#39;')}'>${optionsHtml}</variant-picker>`}
        <p class="product__availability" data-product-availability hidden>Sorry, this combination is sold out.</p>
        <div class="quick-view-modal__quantity-row">
          <div class="quick-view-modal__quantity">
            <button type="button" data-qv-decrease aria-label="Decrease quantity">
              <svg viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <span data-qv-quantity>1</span>
            <button type="button" data-qv-increase aria-label="Increase quantity">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <button type="button" class="quick-view-modal__button" data-product-submit data-quick-add="${firstAvailable.id}" ${firstAvailable.available ? '' : 'disabled'}>
            <span data-product-button-text>${firstAvailable.available ? 'Add to cart' : 'Sold out'}</span>
          </button>
        </div>
        <br>
        <a href="/products/${product.handle}" class="quick-view-modal__link">View full details</a>
      </div>
    `;

    const qtyEl = body.querySelector('[data-qv-quantity]');
    const addBtn = body.querySelector('[data-product-submit]');
    const syncQuantity = () => {
      const qty = parseInt(qtyEl.textContent, 10);
      addBtn.dataset.quickAddQuantity = qty;
    };
    body.querySelector('[data-qv-increase]')?.addEventListener('click', () => {
      qtyEl.textContent = parseInt(qtyEl.textContent, 10) + 1;
      syncQuantity();
    });
    body.querySelector('[data-qv-decrease]')?.addEventListener('click', () => {
      qtyEl.textContent = Math.max(1, parseInt(qtyEl.textContent, 10) - 1);
      syncQuantity();
    });
  }

  function closeQuickView() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.documentElement.removeAttribute('data-scroll-lock');
    setTimeout(() => { modal.hidden = true; }, 250);
  }
})();
