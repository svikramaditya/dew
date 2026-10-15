class FreshlyPickedTabs extends HTMLElement {
  connectedCallback() {
    const section = this.closest('.freshly-picked');
    if (!section) return;
    const triggers = Array.from(this.querySelectorAll('[data-tab-trigger]'));
    const panels = Array.from(section.querySelectorAll('[data-tab-panel]'));

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const index = trigger.dataset.tabTrigger;
        triggers.forEach((t) => t.classList.toggle('is-active', t === trigger));
        panels.forEach((p) => { p.hidden = p.dataset.tabPanel !== index; });
      });
    });
  }
}

if (!customElements.get('freshly-picked-tabs')) {
  customElements.define('freshly-picked-tabs', FreshlyPickedTabs);
}
