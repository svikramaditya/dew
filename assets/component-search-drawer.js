class SearchDrawer extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-search-input]');
    this.resultsEl = this.querySelector('[data-search-results]');
    this.debounceTimer = null;

    this.querySelectorAll('[data-search-close]').forEach((el) => {
      el.addEventListener('click', () => this.close());
    });

    this.addEventListener('click', (event) => {
      if (event.target.closest('[data-search-term]')) {
        const term = event.target.closest('[data-search-term]').textContent.trim();
        this.input.value = term;
        this.fetchResults(term);
      }
    });

    this.input.addEventListener('input', () => {
      clearTimeout(this.debounceTimer);
      const query = this.input.value.trim();
      if (query.length < 2) {
        this.resultsEl.innerHTML = '<p class="search-drawer__hint">' + (this.dataset.startTyping || 'Start typing to search') + '</p>';
        return;
      }
      this.debounceTimer = setTimeout(() => this.fetchResults(query), 280);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.hidden) this.close();
    });

    document.querySelectorAll('[data-search-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => this.open());
    });
  }

  fetchResults(query) {
    const url = `/search/suggest.json?q=${encodeURIComponent(query)}&section_id=predictive-search&resources[type]=product,query&resources[limit]=8&resources[options][unavailable_products]=last`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const html = data?.resources?.results?.sections?.['predictive-search'];
        if (html) this.resultsEl.innerHTML = html;
      })
      .catch(() => {});
  }

  open() {
    this.hidden = false;
    requestAnimationFrame(() => this.classList.add('is-open'));
    document.documentElement.setAttribute('data-scroll-lock', '');
    this.input.focus();
  }

  close() {
    this.classList.remove('is-open');
    document.documentElement.removeAttribute('data-scroll-lock');
    setTimeout(() => { this.hidden = true; }, 220);
  }
}

if (!customElements.get('search-drawer')) {
  customElements.define('search-drawer', SearchDrawer);
}
