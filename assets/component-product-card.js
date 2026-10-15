(function () {
  function getWishlist() {
    try {
      return JSON.parse(localStorage.getItem('dew:wishlist') || '[]');
    } catch (e) {
      return [];
    }
  }

  function setWishlist(ids) {
    localStorage.setItem('dew:wishlist', JSON.stringify(ids));
  }

  function refreshWishlistButtons() {
    const ids = getWishlist().map(String);
    document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
      btn.classList.toggle('is-active', ids.includes(String(btn.dataset.wishlistToggle)));
    });
  }

  document.addEventListener('click', (event) => {
    const wishlistBtn = event.target.closest('[data-wishlist-toggle]');
    if (wishlistBtn) {
      event.preventDefault();
      const id = String(wishlistBtn.dataset.wishlistToggle);
      let ids = getWishlist().map(String);
      if (ids.includes(id)) {
        ids = ids.filter((item) => item !== id);
      } else {
        ids.push(id);
      }
      setWishlist(ids);
      refreshWishlistButtons();
      return;
    }

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
      quickAdd.disabled = true;
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id, quantity: 1 }),
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

  function openQuickView(handle) {
    const el = ensureModal();
    const body = el.querySelector('.quick-view-modal__body');
    body.innerHTML = '<p>Loading…</p>';
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    document.documentElement.setAttribute('data-scroll-lock', '');

    fetch(`/products/${handle}.js`)
      .then((res) => res.json())
      .then((product) => {
        const variant = product.variants[0];
        const image = product.images[0];
        const price = '$' + (variant.price / 100).toFixed(2);
        body.innerHTML = `
          <div class="quick-view-modal__media">
            ${image ? `<img src="${image}" alt="${product.title}" width="600">` : ''}
          </div>
          <div class="quick-view-modal__info">
            <h2 class="quick-view-modal__title">${product.title}</h2>
            <p class="quick-view-modal__price">${price}</p>
            <p>${product.description.replace(/<[^>]*>/g, '').slice(0, 160)}</p>
            <button type="button" class="quick-view-modal__button" data-quick-add="${variant.id}">Add to cart</button>
            <br>
            <a href="/products/${product.handle}" class="quick-view-modal__link">View full details</a>
          </div>
        `;
      })
      .catch(() => {
        body.innerHTML = '<p>Could not load this product.</p>';
      });
  }

  function closeQuickView() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.documentElement.removeAttribute('data-scroll-lock');
    setTimeout(() => { modal.hidden = true; }, 250);
  }

  document.addEventListener('DOMContentLoaded', refreshWishlistButtons);
  if (document.readyState !== 'loading') refreshWishlistButtons();
})();
