class HeroSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.hero-slider__track');
    this.slides = Array.from(this.querySelectorAll('[data-hero-slide]'));
    this.dots = Array.from(this.querySelectorAll('[data-hero-dot]'));
    if (this.slides.length < 2) return;

    this.index = 0;
    this.transition = this.dataset.transition || 'fade';
    this.autoplay = this.dataset.autoplay === 'true';
    this.interval = parseInt(this.dataset.interval, 10) || 5000;

    const prev = this.querySelector('[data-hero-prev]');
    const next = this.querySelector('[data-hero-next]');
    if (prev) prev.addEventListener('click', () => this.go(this.index - 1));
    if (next) next.addEventListener('click', () => this.go(this.index + 1));

    this.dots.forEach((dot) => {
      dot.addEventListener('click', () => this.go(parseInt(dot.dataset.heroDot, 10)));
    });

    this.addEventListener('mouseenter', () => this.stopAutoplay());
    this.addEventListener('mouseleave', () => this.startAutoplay());

    this.startAutoplay();
  }

  go(index) {
    const count = this.slides.length;
    this.index = (index + count) % count;

    if (this.transition === 'slide') {
      this.track.style.transform = `translateX(-${this.index * 100}%)`;
    } else {
      this.slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === this.index);
      });
    }

    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.index);
    });
  }

  startAutoplay() {
    if (!this.autoplay) return;
    this.stopAutoplay();
    this.timer = setInterval(() => this.go(this.index + 1), this.interval);
  }

  stopAutoplay() {
    if (this.timer) clearInterval(this.timer);
  }

  disconnectedCallback() {
    this.stopAutoplay();
  }
}

if (!customElements.get('hero-slider')) {
  customElements.define('hero-slider', HeroSlider);
}
