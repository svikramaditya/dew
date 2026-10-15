class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.thumbs = Array.from(this.querySelectorAll('[data-gallery-thumb]'));
    this.slides = Array.from(this.querySelectorAll('[data-gallery-slide]'));
    if (this.thumbs.length === 0) return;

    this.thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const index = thumb.dataset.galleryThumb;
        this.thumbs.forEach((t) => t.classList.toggle('is-active', t === thumb));
        this.slides.forEach((slide) => {
          slide.classList.toggle('is-active', slide.dataset.gallerySlide === index);
        });
      });
    });
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
