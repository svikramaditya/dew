class ScrollRevealText extends HTMLElement {
  connectedCallback() {
    this.words = Array.from(this.querySelectorAll('.philosophy__word'));
    if (this.words.length === 0) return;
    this.ticking = false;
    this.onScroll = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    this.onScroll();
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
    const rect = this.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    // Progress 0 when the block's bottom reaches the bottom of the
    // viewport, progress 1 when its top reaches a third of the way up --
    // so the text finishes lighting up before it scrolls past.
    const start = viewportHeight * 0.9;
    const end = viewportHeight * 0.25;
    const total = rect.height;
    const scrolled = start - rect.top;
    const distance = (start - end) + total;
    let progress = scrolled / distance;
    progress = Math.max(0, Math.min(1, progress));

    const activeCount = Math.floor(progress * this.words.length);
    this.words.forEach((word, i) => {
      word.style.opacity = i < activeCount ? '1' : '0.3';
    });
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }
}

if (!customElements.get('scroll-reveal-text')) {
  customElements.define('scroll-reveal-text', ScrollRevealText);
}
