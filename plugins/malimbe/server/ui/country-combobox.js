const DEFAULT_COUNTRIES = [
  ["AR", "Argentina"], ["AU", "Australia"], ["BR", "Brazil"], ["CA", "Canada"],
  ["CL", "Chile"], ["CN", "China"], ["CO", "Colombia"], ["DK", "Denmark"],
  ["EG", "Egypt"], ["FI", "Finland"], ["FR", "France"], ["DE", "Germany"],
  ["GH", "Ghana"], ["GR", "Greece"], ["IN", "India"], ["IE", "Ireland"],
  ["IT", "Italy"], ["JP", "Japan"], ["KE", "Kenya"], ["MX", "Mexico"],
  ["NL", "Netherlands"], ["NZ", "New Zealand"], ["NG", "Nigeria"], ["NO", "Norway"],
  ["PE", "Peru"], ["PT", "Portugal"], ["SG", "Singapore"], ["ZA", "South Africa"],
  ["KR", "South Korea"], ["ES", "Spain"], ["SE", "Sweden"], ["CH", "Switzerland"],
  ["TH", "Thailand"], ["TR", "Turkiye"], ["UA", "Ukraine"], ["GB", "United Kingdom"],
  ["US", "United States"], ["UY", "Uruguay"], ["VN", "Vietnam"],
];

const styles = `
  :host { display: block; max-width: 28rem; color: #172033; font: 16px/1.5 system-ui, sans-serif; }
  .field { display: grid; gap: 0.4rem; }
  label { font-weight: 700; }
  .hint, .status { color: #536174; font-size: 0.875rem; }
  .control { position: relative; }
  input { width: 100%; min-height: 2.75rem; box-sizing: border-box; padding: 0.6rem 2.5rem 0.6rem 0.75rem; border: 2px solid #64748b; border-radius: 0.4rem; color: inherit; background: #fff; font: inherit; }
  input:focus-visible { outline: 3px solid #d97706; outline-offset: 2px; }
  input[aria-expanded="true"] { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .chevron { position: absolute; right: 0.8rem; top: 50%; transform: translateY(-50%); pointer-events: none; }
  [role="listbox"] { position: absolute; z-index: 1; width: 100%; max-height: 14rem; overflow: auto; margin: 0; padding: 0.25rem; box-sizing: border-box; border: 2px solid #64748b; border-top: 0; border-radius: 0 0 0.4rem 0.4rem; background: #fff; list-style: none; }
  [role="option"] { padding: 0.6rem 0.75rem; border-radius: 0.25rem; cursor: pointer; }
  [role="option"][aria-selected="true"], [role="option"]:hover { background: #e0ecff; }
  [role="option"]:focus { outline: 3px solid #d97706; }
  .hidden { display: none; }
  @media (forced-colors: active) { input, [role="listbox"] { border: 2px solid CanvasText; } [role="option"][aria-selected="true"] { background: Highlight; color: HighlightText; } }
  @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;

export class CountryCombobox extends HTMLElement {
  static formAssociated = true;
  static observedAttributes = ["disabled", "required"];

  #internals;
  #input;
  #listbox;
  #status;
  #options = DEFAULT_COUNTRIES.map(([value, label]) => ({ value, label }));
  #filtered = this.#options;
  #active = -1;
  #selected = null;
  #closeTimer;

  constructor() {
    super();
    this.#internals = this.attachInternals?.();
    const shadow = this.attachShadow({ mode: "open", delegatesFocus: true });
    shadow.innerHTML = `<style>${styles}</style>
      <div class="field">
        <label id="label" part="label">${this.getAttribute("label") || "Country"}</label>
        <span class="hint" id="hint">Type to filter countries, then use the arrow keys to choose one.</span>
        <div class="control">
          <input part="input" type="text" role="combobox" autocomplete="off" aria-autocomplete="list" aria-expanded="false" aria-controls="country-options" aria-labelledby="label" aria-describedby="hint">
          <span class="chevron" aria-hidden="true">v</span>
          <ul part="listbox" id="country-options" role="listbox" aria-labelledby="label" class="hidden"></ul>
        </div>
        <span class="status" id="status" role="status" aria-live="polite"></span>
      </div>`;
    this.#input = shadow.querySelector("input");
    this.#listbox = shadow.querySelector("[role=listbox]");
    this.#status = shadow.querySelector(".status");
    this.#input.addEventListener("input", () => { this.#filter(this.#input.value); this.#open(); });
    this.#input.addEventListener("focus", () => { this.#filter(this.#input.value); this.#open(); });
    this.#input.addEventListener("keydown", (event) => this.#onKeydown(event));
    this.#listbox.addEventListener("mousedown", (event) => event.preventDefault());
    this.#listbox.addEventListener("click", (event) => {
      const option = event.target.closest("[role=option]");
      if (option) this.#select(Number(option.dataset.index));
    });
    this.addEventListener("focusout", () => {
      clearTimeout(this.#closeTimer);
      this.#closeTimer = setTimeout(() => {
        if (!this.contains(document.activeElement) && !this.shadowRoot.contains(this.shadowRoot.activeElement)) this.#close();
      }, 0);
    });
    this.#render();
  }

  connectedCallback() { this.#syncDisabled(); }

  attributeChangedCallback(name) {
    if (name === "disabled") this.#syncDisabled();
    if (name === "required") this.#input.required = this.hasAttribute("required");
  }

  get value() { return this.#selected?.value || ""; }
  set value(value) { this.#select(this.#options.findIndex((item) => item.value === value), false); }

  #syncDisabled() { this.#input.disabled = this.hasAttribute("disabled"); if (this.#input.disabled) this.#close(); }

  #open() { if (this.#input.disabled) return; this.#input.setAttribute("aria-expanded", "true"); this.#listbox.classList.remove("hidden"); }
  #close() { this.#input.setAttribute("aria-expanded", "false"); this.#input.removeAttribute("aria-activedescendant"); this.#listbox.classList.add("hidden"); this.#active = -1; this.#render(); }

  #filter(query) {
    const normalized = query.trim().toLocaleLowerCase();
    this.#filtered = this.#options.filter((item) => item.label.toLocaleLowerCase().includes(normalized));
    this.#active = -1;
    this.#status.textContent = this.#filtered.length ? `${this.#filtered.length} country${this.#filtered.length === 1 ? "" : "ies"} available.` : "No countries found.";
    this.#render();
  }

  #onKeydown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      this.#open();
      if (this.#filtered.length) this.#active = (this.#active + (event.key === "ArrowDown" ? 1 : -1) + this.#filtered.length) % this.#filtered.length;
      this.#render();
    } else if (event.key === "Home" && this.#input.getAttribute("aria-expanded") === "true") { event.preventDefault(); this.#active = 0; this.#render();
    } else if (event.key === "End" && this.#input.getAttribute("aria-expanded") === "true") { event.preventDefault(); this.#active = this.#filtered.length - 1; this.#render();
    } else if (event.key === "Enter" && this.#input.getAttribute("aria-expanded") === "true" && this.#active >= 0) { event.preventDefault(); this.#select(this.#active);
    } else if (event.key === "Escape") { event.preventDefault(); this.#close(); }
  }

  #select(index, announce = true) {
    const item = this.#filtered[index] || (index >= 0 ? this.#options[index] : null);
    if (!item) return;
    this.#selected = item;
    this.#input.value = item.label;
    this.#internals?.setFormValue(item.value);
    if (announce) this.#status.textContent = `${item.label} selected.`;
    this.#close();
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #render() {
    this.#listbox.innerHTML = this.#filtered.map((item, index) => `<li id="country-option-${index}" role="option" aria-selected="${index === this.#active}" data-index="${index}">${item.label}</li>`).join("");
    if (this.#active >= 0) this.#input.setAttribute("aria-activedescendant", `country-option-${this.#active}`);
    else this.#input.removeAttribute("aria-activedescendant");
  }
}

if (!customElements.get("country-combobox")) customElements.define("country-combobox", CountryCombobox);