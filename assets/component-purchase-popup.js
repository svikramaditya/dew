class PurchasePopup extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('[data-purchase-item]'));
    if (this.items.length === 0) return;

    this.displayMs = (parseInt(this.dataset.displaySeconds, 10) || 6) * 1000;
    this.intervalMs = (parseInt(this.dataset.intervalSeconds, 10) || 12) * 1000;
    this.index = -1;
    this.dismissed = false;

    this.items.forEach((item) => {
      item.querySelector('[data-purchase-close]').addEventListener('click', () => {
        this.hideCurrent();
        this.dismissed = true;
        clearTimeout(this.showTimer);
      });
    });

    this.hidden = false;
    this.scheduleNext(2500);
  }

  scheduleNext(delay) {
    this.showTimer = setTimeout(() => {
      if (this.dismissed) return;
      this.showNext();
    }, delay);
  }

  showNext() {
    this.hideCurrent();
    this.index = (this.index + 1) % this.items.length;
    const item = this.items[this.index];
    item.classList.add('is-visible');

    setTimeout(() => {
      this.hideCurrent();
      this.scheduleNext(this.intervalMs);
    }, this.displayMs);
  }

  hideCurrent() {
    this.items.forEach((item) => item.classList.remove('is-visible'));
  }
}

if (!customElements.get('purchase-popup')) {
  customElements.define('purchase-popup', PurchasePopup);
}
