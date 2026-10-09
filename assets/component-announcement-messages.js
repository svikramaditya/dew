class AnnouncementMessages extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.announcement-bar__message'));
    if (this.items.length < 2) return;
    this.index = 0;
    this.items[0].classList.add('is-active');
    this.timer = setInterval(() => this.next(), 4000);
  }

  next() {
    this.items[this.index].classList.remove('is-active');
    this.index = (this.index + 1) % this.items.length;
    this.items[this.index].classList.add('is-active');
  }

  disconnectedCallback() {
    if (this.timer) clearInterval(this.timer);
  }
}

if (!customElements.get('announcement-messages')) {
  customElements.define('announcement-messages', AnnouncementMessages);
}
