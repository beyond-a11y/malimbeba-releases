# Carousel web component

**Release status: reference component, ungated.** It ships as a reference example.
It has not passed the enterprise release gate (`a11y_release_gate`), and its
manual reviews (screen-reader output, touch and pointer behavior, forced colors)
are not done. Automated axe and behavior tests cover it in this repository.

`<malimbe-carousel>` is a framework-agnostic custom element. Load the module once
in the browser, then place each slide in a direct child with `slot="slide"`:
the runnable [demo](../ui/carousel-demo.html) shows manual and automatic
navigation in a styled example.

```html
<script type="module" src="/components/carousel.js"></script>

<malimbe-carousel aria-label="Featured stories">
  <article slot="slide">
    <h2>First story</h2>
    <a href="/stories/first">Read the first story</a>
  </article>
  <article slot="slide">
    <h2>Second story</h2>
    <a href="/stories/second">Read the second story</a>
  </article>
</malimbe-carousel>
```

The same custom element markup works in React, Vue, Angular, and other frameworks
that support custom elements. Framework code can use the `previous()`, `next()`,
and `goTo(index)` methods or listen for the bubbling, composed `slidechange`
event. Its `detail` contains the zero-based `index`, active `slide`, and `source`
(`previous`, `next`, `api`, or `rotation`).

Nothing rotates on page load. Add `autoplay` to show the start/stop button, and
optionally set `interval` in milliseconds (minimum 1000; default 5000):

```html
<malimbe-carousel aria-label="Featured stories" autoplay interval="6000">
  <!-- slides -->
</malimbe-carousel>
```

The start/stop button controls rotation. Hovering over the carousel holds rotation
until the pointer leaves, without changing the button's state. Focus entering a
slide control stops rotation. Automatic rotation is not announced to assistive
technology; after a user presses Next or Previous, a short status is announced
with the slide's position and its first heading, such as "Slide 2 of 3: Second
story". A slide with no heading is announced by position only. Inactive slides are hidden from sight and assistive technology.
Native buttons provide Tab, Enter, and Space keyboard operation; focus is not
trapped, and arrow keys are not intercepted.
