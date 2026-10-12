class FaqAccordion extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.faq__item'));
    this.items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (item.open) {
          this.items.forEach((other) => {
            if (other !== item) other.open = false;
          });
        }
      });
    });
  }
}

if (!customElements.get('faq-accordion')) {
  customElements.define('faq-accordion', FaqAccordion);
}
