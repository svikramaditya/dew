class NewsletterPopup extends HTMLElement {
  connectedCallback() {
    if (this.hasSeenPopup()) return;

    this.querySelectorAll('[data-popup-close]').forEach((el) => {
      el.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });

    const delay = parseInt(this.dataset.delay, 10) || 6000;
    this.timer = setTimeout(() => this.open(), delay);

    this.addEventListener('submit', () => this.markSeen());
  }

  hasSeenPopup() {
    return document.cookie.split('; ').some((row) => row.startsWith('dew_newsletter_seen='));
  }

  markSeen() {
    const maxAge = 60 * 60 * 24 * 14;
    document.cookie = `dew_newsletter_seen=1; path=/; max-age=${maxAge}`;
  }

  open() {
    this.hidden = false;
    requestAnimationFrame(() => this.classList.add('is-open'));
    document.documentElement.setAttribute('data-scroll-lock', '');
  }

  close() {
    this.classList.remove('is-open');
    document.documentElement.removeAttribute('data-scroll-lock');
    this.markSeen();
    setTimeout(() => { this.hidden = true; }, 320);
  }
}

if (!customElements.get('newsletter-popup')) {
  customElements.define('newsletter-popup', NewsletterPopup);
}
