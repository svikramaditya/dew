class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.variants = JSON.parse(this.dataset.productJson.replace(/&#39;/g, "'"));
    // Price/title live as siblings of the <form> on the real PDP (inside
    // .product__info), but the form itself only wraps the variant id input
    // and the submit button -- so price/availability lookups need the wider
    // wrapper, while the form-only elements stay scoped to the form. Quick
    // view has no <form> at all, so .quick-view-modal__info covers both.
    this.form = this.closest('form');
    this.wrapper = this.closest('.product__info') || this.closest('.quick-view-modal__info') || this.form || this.parentElement;
    this.input = (this.form || this.wrapper).querySelector('[data-product-variant-id]');
    this.priceEl = this.wrapper.querySelector('[data-product-price]');
    this.compareEl = this.wrapper.querySelector('[data-product-price-compare]');
    this.availabilityEl = this.wrapper.querySelector('[data-product-availability]');
    this.submitBtn = this.wrapper.querySelector('[data-product-submit]');
    this.submitBtnText = this.wrapper.querySelector('[data-product-button-text]');

    this.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-option-value]');
      if (!btn) return;
      const position = btn.dataset.optionPosition;
      const group = this.querySelector(`[data-option-position="${position}"]`);
      group.querySelectorAll('[data-option-value]').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      group.querySelector('[data-selected-value]').textContent = btn.dataset.value;
      this.updateVariant();
    });

    this.updateVariant();
  }

  getSelectedOptions() {
    const groups = Array.from(this.querySelectorAll('[data-option-position]'));
    return groups
      .sort((a, b) => a.dataset.optionPosition - b.dataset.optionPosition)
      .map((group) => group.querySelector('.is-selected')?.dataset.value);
  }

  updateVariant() {
    const selected = this.getSelectedOptions();
    const match = this.variants.find((variant) => {
      const options = [variant.option1, variant.option2, variant.option3].filter(Boolean);
      return selected.every((value, i) => value === undefined || options[i] === value);
    });

    this.querySelectorAll('[data-option-value]').forEach((btn) => btn.classList.remove('is-unavailable'));

    if (!match) return;

    if (this.input) this.input.value = match.id;
    if (this.submitBtn && this.submitBtn.hasAttribute('data-quick-add')) {
      this.submitBtn.dataset.quickAdd = match.id;
    }
    if (this.priceEl) {
      const amountEl = this.priceEl.querySelector('[data-price-amount]');
      if (amountEl) amountEl.textContent = this.formatMoney(match.price);
    }
    if (this.compareEl) {
      if (match.compare_at_price && match.compare_at_price > match.price) {
        this.compareEl.textContent = this.formatMoney(match.compare_at_price);
        this.compareEl.hidden = false;
      } else {
        this.compareEl.hidden = true;
      }
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = !match.available;
    }
    if (this.submitBtnText) {
      this.submitBtnText.textContent = match.available
        ? (this.dataset.addToCartLabel || 'Add to cart')
        : (this.dataset.soldOutLabel || 'Sold out');
    }
    if (this.availabilityEl) {
      this.availabilityEl.hidden = match.available;
    }
  }

  formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }
}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPicker);
}
