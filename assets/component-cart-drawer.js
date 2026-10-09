class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.itemsEl = this.querySelector('[data-cart-items]');
    this.countEls = document.querySelectorAll('[data-cart-count], [data-cart-item-count]');
    this.totalEl = this.querySelector('[data-cart-total]');
    this.originalTotalEl = this.querySelector('[data-cart-original-total]');
    this.progressBar = this.querySelector('[data-cart-progress-bar]');
    this.shippingMessage = this.querySelector('[data-cart-shipping-message]');
    this.recommendationsEl = this.querySelector('[data-cart-recommendations]');
    this.recommendationsList = this.querySelector('[data-cart-recommendations-list]');
    this.threshold = parseInt(this.dataset.freeShippingThreshold || '0', 10);

    this.querySelectorAll('[data-cart-close]').forEach((el) => {
      el.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });

    document.querySelectorAll('[data-cart-toggle]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
      });
    });

    this.itemsEl.addEventListener('click', (event) => {
      const row = event.target.closest('[data-cart-line]');
      if (!row) return;
      const line = parseInt(row.dataset.cartLine, 10);
      if (event.target.closest('[data-cart-increase]')) {
        const qty = parseInt(row.querySelector('[data-cart-quantity]').textContent, 10) + 1;
        this.changeLine(line, qty);
      } else if (event.target.closest('[data-cart-decrease]')) {
        const qty = parseInt(row.querySelector('[data-cart-quantity]').textContent, 10) - 1;
        this.changeLine(line, Math.max(0, qty));
      } else if (event.target.closest('[data-cart-remove]')) {
        this.changeLine(line, 0);
      }
    });

    const noteToggle = this.querySelector('[data-cart-note-toggle]');
    const noteEl = this.querySelector('[data-cart-note]');
    if (noteToggle) {
      noteToggle.addEventListener('click', () => {
        noteEl.hidden = !noteEl.hidden;
      });
    }
    const noteSave = this.querySelector('[data-cart-note-save]');
    if (noteSave) {
      noteSave.addEventListener('click', () => {
        const note = this.querySelector('[data-cart-note-input]').value;
        fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note }),
        });
      });
    }

    this.bindAjaxForms();
    this.updateShippingUI(window.__dewCartTotal || 0);
  }

  bindAjaxForms() {
    document.querySelectorAll('form.ajax-cart-form').forEach((form) => {
      if (form.dataset.ajaxBound) return;
      form.dataset.ajaxBound = 'true';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        const formData = new FormData(form);
        fetch('/cart/add.js', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: formData,
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.status) {
              throw new Error(data.description || 'Could not add to cart');
            }
            return this.refresh();
          })
          .then(() => this.open())
          .catch(() => {})
          .finally(() => {
            if (submitButton) submitButton.disabled = false;
          });
      });
    });
  }

  changeLine(line, quantity) {
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line, quantity }),
    })
      .then((res) => res.json())
      .then((cart) => this.render(cart));
  }

  refresh() {
    return fetch('/cart.js')
      .then((res) => res.json())
      .then((cart) => this.render(cart));
  }

  render(cart) {
    window.__dewCartTotal = cart.total_price;
    this.countEls.forEach((el) => {
      el.textContent = cart.item_count;
      if (el.hasAttribute('hidden') !== (cart.item_count === 0)) {
        el.hidden = cart.item_count === 0;
      }
    });

    if (cart.items.length === 0) {
      this.itemsEl.innerHTML = `<p class="cart-drawer__empty">${this.dataset.emptyText || 'Your cart is empty.'}</p>`;
    } else {
      this.itemsEl.innerHTML = cart.items.map((item, index) => this.lineTemplate(item, index + 1)).join('');
    }

    if (this.totalEl) this.totalEl.textContent = this.formatMoney(cart.total_price);
    if (this.originalTotalEl) {
      if (cart.original_total_price > cart.total_price) {
        this.originalTotalEl.textContent = this.formatMoney(cart.original_total_price);
        this.originalTotalEl.hidden = false;
      } else {
        this.originalTotalEl.hidden = true;
      }
    }

    this.updateShippingUI(cart.total_price);

    if (cart.items.length > 0) {
      this.loadRecommendations(cart.items[0].product_id);
    } else if (this.recommendationsEl) {
      this.recommendationsEl.hidden = true;
    }
  }

  lineTemplate(item, line) {
    const variantLine = item.variant_title && item.variant_title !== 'Default Title'
      ? `<p class="cart-drawer__item-variant">${item.variant_title}</p>`
      : '';
    return `
      <div class="cart-drawer__item" data-cart-line="${line}">
        <a href="${item.url}" class="cart-drawer__item-media">
          ${item.image ? `<img src="${item.image}" alt="${item.product_title}" width="200" loading="lazy">` : ''}
        </a>
        <div class="cart-drawer__item-content">
          <a href="${item.url}" class="cart-drawer__item-title">${item.product_title}</a>
          ${variantLine}
          <div class="cart-drawer__item-row">
            <div class="cart-drawer__stepper">
              <button type="button" data-cart-decrease aria-label="Decrease quantity">${this.icon('minus')}</button>
              <span data-cart-quantity>${item.quantity}</span>
              <button type="button" data-cart-increase aria-label="Increase quantity">${this.icon('plus')}</button>
            </div>
            <span class="cart-drawer__item-price">${this.formatMoney(item.final_line_price)}</span>
          </div>
        </div>
        <button type="button" class="cart-drawer__item-remove" data-cart-remove aria-label="Remove">${this.icon('trash')}</button>
      </div>
    `;
  }

  icon(name) {
    const icons = {
      minus: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7H20M9 7V4.8C9 4.358 9.358 4 9.8 4H14.2C14.642 4 15 4.358 15 4.8V7M18 7L17.3 19.1C17.26 19.78 16.7 20.3 16.02 20.3H7.98C7.3 20.3 6.74 19.78 6.7 19.1L6 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[name] || '';
  }

  formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  updateShippingUI(totalCents) {
    if (!this.progressBar || !this.threshold) {
      if (this.shippingMessage) this.shippingMessage.textContent = '';
      return;
    }
    const remaining = this.threshold - totalCents;
    const percent = Math.min(100, Math.max(0, (totalCents / this.threshold) * 100));
    this.progressBar.style.width = percent + '%';
    if (remaining <= 0) {
      this.shippingMessage.textContent = this.dataset.freeShippingUnlocked || "You've unlocked free shipping!";
    } else {
      const label = this.dataset.freeShippingLabel || 'Spend {amount} more for free shipping';
      this.shippingMessage.textContent = label.replace('{amount}', this.formatMoney(remaining));
    }
  }

  loadRecommendations(productId) {
    if (!this.recommendationsEl) return;
    fetch(`/recommendations/products.json?product_id=${productId}&limit=3&intent=related`)
      .then((res) => res.json())
      .then((data) => {
        const products = (data.products || []).slice(0, 3);
        if (products.length === 0) {
          this.recommendationsEl.hidden = true;
          return;
        }
        this.recommendationsList.innerHTML = products.map((product) => `
          <div class="cart-drawer__recommendation">
            <img src="${product.featured_image}" alt="${product.title}" loading="lazy">
            <div>
              <p class="cart-drawer__recommendation-title">${product.title}</p>
              <p class="cart-drawer__recommendation-price">${this.formatMoney(product.price)}</p>
            </div>
            <button type="button" class="cart-drawer__recommendation-add" data-quick-add="${product.variants[0].id}">+</button>
          </div>
        `).join('');
        this.recommendationsEl.hidden = false;
      })
      .catch(() => { this.recommendationsEl.hidden = true; });
  }

  open() {
    this.hidden = false;
    requestAnimationFrame(() => this.classList.add('is-open'));
    document.documentElement.setAttribute('data-scroll-lock', '');
  }

  close() {
    this.classList.remove('is-open');
    document.documentElement.removeAttribute('data-scroll-lock');
    setTimeout(() => { this.hidden = true; }, 320);
  }
}

if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}

document.addEventListener('click', (event) => {
  const quickAdd = event.target.closest('[data-quick-add]');
  if (!quickAdd) return;
  const id = quickAdd.dataset.quickAdd;
  quickAdd.disabled = true;
  fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id, quantity: 1 }),
  })
    .then((res) => res.json())
    .then(() => {
      const drawer = document.querySelector('cart-drawer');
      if (drawer) drawer.refresh();
    })
    .finally(() => { quickAdd.disabled = false; });
});
