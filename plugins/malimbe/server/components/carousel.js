const DEFAULT_INTERVAL = 5000;

export class MalimbeCarousel extends HTMLElement {
  static get observedAttributes() {
    return ["autoplay", "interval"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: inherit;
        }

        .viewport {
          min-width: 0;
        }

        ::slotted([hidden]) {
          display: none !important;
        }

        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-block-start: 1rem;
        }

        button {
          min-width: 2.75rem;
          min-height: 2.75rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid currentColor;
          border-radius: 0.25rem;
          background: Canvas;
          color: CanvasText;
          font: inherit;
          cursor: pointer;
        }

        button:focus-visible {
          outline: 3px solid Highlight;
          outline-offset: 3px;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .status {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }

        @media (forced-colors: active) {
          button {
            border: 1px solid ButtonText;
          }

          button:focus-visible {
            outline-color: Highlight;
          }
        }
      </style>
      <div class="viewport">
        <slot name="slide"><p>No slides available.</p></slot>
      </div>
      <div class="controls">
        <button type="button" data-rotation hidden>Start slide rotation</button>
        <button type="button" data-previous>Previous slide</button>
        <button type="button" data-next>Next slide</button>
      </div>
      <p class="status" role="status"></p>
    `;

    this.statusRegion = this.shadowRoot.querySelector(".status");
    this.slideSlot = this.shadowRoot.querySelector("slot");
    this.rotationButton = this.shadowRoot.querySelector("[data-rotation]");
    this.previousButton = this.shadowRoot.querySelector("[data-previous]");
    this.nextButton = this.shadowRoot.querySelector("[data-next]");
    this.activeIndex = 0;
    this.rotationTimer = undefined;
    this.isRotating = false;
    this.isHovered = false;

    this.slideSlot.addEventListener("slotchange", () => this.refreshSlides());
    this.rotationButton.addEventListener("click", () => {
      if (this.isRotating) this.stopRotation();
      else this.startRotation();
    });
    this.previousButton.addEventListener("click", () => this.previous());
    this.nextButton.addEventListener("click", () => this.next());
    const stopOnFocusElsewhere = (event) => {
      if (!event.composedPath().includes(this.rotationButton)) this.stopRotation();
    };
    this.addEventListener("focusin", stopOnFocusElsewhere);
    this.shadowRoot.addEventListener("focusin", stopOnFocusElsewhere);
    this.addEventListener("pointerenter", () => {
      this.isHovered = true;
      this.clearRotationTimer();
    });
    this.addEventListener("pointerleave", () => {
      this.isHovered = false;
      this.syncRotationTimer();
    });
  }

  connectedCallback() {
    this.setAttribute("role", "region");
    this.setAttribute("aria-roledescription", "carousel");
    if (!this.hasAttribute("aria-label")) {
      this.setAttribute("aria-label", this.getAttribute("label") || "Carousel");
    }
    this.refreshSlides();
    this.updateRotationControl();
  }

  disconnectedCallback() {
    this.clearRotationTimer();
    this.isHovered = false;
  }

  attributeChangedCallback(name) {
    if (!this.isConnected) return;
    if (name === "autoplay") {
      if (this.hasAttribute("autoplay")) this.updateRotationControl();
      else this.stopRotation();
      return;
    }
    if (name === "interval") this.syncRotationTimer();
  }

  get slides() {
    return this.slideSlot.assignedElements().filter((slide) => slide.slot === "slide");
  }

  get interval() {
    const value = Number(this.getAttribute("interval"));
    return Number.isFinite(value) && value >= 1000 ? value : DEFAULT_INTERVAL;
  }

  refreshSlides() {
    const slides = this.slides;
    if (!slides.length) this.activeIndex = 0;
    else this.activeIndex = Math.min(this.activeIndex, slides.length - 1);

    slides.forEach((slide, index) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", `Slide ${index + 1} of ${slides.length}`);
      const active = index === this.activeIndex;
      slide.hidden = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });

    const canNavigate = slides.length > 1;
    this.previousButton.disabled = !canNavigate;
    this.nextButton.disabled = !canNavigate;
    this.updateRotationControl();
    if (!canNavigate) this.stopRotation();
  }

  updateRotationControl() {
    const canRotate = this.hasAttribute("autoplay") && this.slides.length > 1;
    this.rotationButton.hidden = !canRotate;
    if (!canRotate) {
      this.clearRotationTimer();
      this.isRotating = false;
    }
    this.rotationButton.textContent = this.isRotating
      ? "Stop slide rotation"
      : "Start slide rotation";
  }

  previous() {
    this.goTo(this.activeIndex - 1, "previous");
  }

  next() {
    this.goTo(this.activeIndex + 1, "next");
  }

  goTo(index, source = "api") {
    const slides = this.slides;
    if (!Number.isInteger(index) || slides.length < 2) return;
    this.stopRotation();
    const nextIndex = ((index % slides.length) + slides.length) % slides.length;
    if (nextIndex === this.activeIndex) return;

    this.activeIndex = nextIndex;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === nextIndex;
      slide.hidden = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });
    if (source === "next" || source === "previous") {
      const heading = slides[nextIndex].querySelector("h1, h2, h3, h4, h5, h6")?.textContent.trim();
      const position = `Slide ${nextIndex + 1} of ${slides.length}`;
      this.statusRegion.textContent = heading ? `${position}: ${heading}` : position;
    }
    this.dispatchEvent(new CustomEvent("slidechange", {
      bubbles: true,
      composed: true,
      detail: { index: nextIndex, slide: slides[nextIndex], source },
    }));
  }

  startRotation() {
    if (!this.hasAttribute("autoplay") || this.slides.length < 2) return;
    this.isRotating = true;
    this.updateRotationControl();
    this.syncRotationTimer();
  }

  stopRotation() {
    this.isRotating = false;
    this.updateRotationControl();
    this.clearRotationTimer();
  }

  syncRotationTimer() {
    this.clearRotationTimer();
    if (this.isRotating && !this.isHovered) this.scheduleRotation();
  }

  clearRotationTimer() {
    if (this.rotationTimer !== undefined) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  scheduleRotation() {
    this.rotationTimer = setInterval(() => {
      const nextIndex = (this.activeIndex + 1) % this.slides.length;
      this.showRotatedSlide(nextIndex);
    }, this.interval);
  }

  showRotatedSlide(index) {
    const slides = this.slides;
    if (slides.length < 2) {
      this.stopRotation();
      return;
    }
    this.activeIndex = index;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === index;
      slide.hidden = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });
    this.dispatchEvent(new CustomEvent("slidechange", {
      bubbles: true,
      composed: true,
      detail: { index, slide: slides[index], source: "rotation" },
    }));
  }
}

if (!customElements.get("malimbe-carousel")) {
  customElements.define("malimbe-carousel", MalimbeCarousel);
}
