class HorizontalScrollSection extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-h-scroll-track]');
    if (!this.track) return;

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.prefersReducedMotion) return;

    this.ticking = false;
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);

    this.onResize();
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);
  }

  onResize() {
    const overflow = Math.max(0, this.track.scrollWidth - window.innerWidth);
    this.scrollDistance = overflow;
    this.style.height = `calc(100vh + ${overflow}px)`;
    this.update();
  }

  onScroll() {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.update();
      this.ticking = false;
    });
  }

  update() {
    if (!this.scrollDistance) return;
    const rect = this.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -rect.top / this.scrollDistance));
    this.track.style.transform = `translateX(-${progress * this.scrollDistance}px)`;
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onResize);
  }
}

if (!customElements.get('horizontal-scroll-section')) {
  customElements.define('horizontal-scroll-section', HorizontalScrollSection);
}
