# TODO

## Scroll feel — make inertia/momentum more iOS-native

Current setup uses an internal `<div overflow-y-auto>` as the scroll
container. iOS reserves its smoothest momentum scrolling for the
document/body scroll, so internal-div scrolling always feels a bit "less
native" no matter how we tune it. `-webkit-overflow-scrolling: touch` is
basically a no-op on iOS 13+.

In rough priority order:

### 1. (⭐⭐⭐) Move scroll from inner div to body

The big single change. Architecture goes from:

```
<div h-screen overflow-y-auto>   ← inner scroll container
  <div min-h-screen snap-start>section</div>
  ...
</div>
```

to:

```
<header fixed top-0 />
<div min-h-screen snap-start>section</div>   ← directly in body
<div min-h-screen snap-start>section</div>
...
```

Touch points:
- `ScrollSnapContainer` loses its own scroll container; `<main>` becomes
  natural document flow
- `scroll-snap-type: y proximity` moves to `<html>` (globals.css or the
  layout's html element)
- Header hide/show listens on `window.scroll` (currently `containerRef`)
- Tab click: `window.scrollTo({ top: section.offsetTop })`
- IntersectionObserver: `root: null` so it observes against viewport

Risk: any other code that assumed an internal scroll container needs an
audit (likely none in this app, but worth checking).

### 2. (⭐⭐) Sections use `min-h-dvh` instead of `min-h-screen`

`100vh` ignores the iOS URL bar collapsing on scroll — sections briefly
mis-size, causing snap points to drift and the scroll to "catch". `100dvh`
(dynamic viewport height) tracks the real visible area.

Trivial change once we know browser support is fine (iOS 16+, Chrome 108+
— probably OK now).

### 3. (⭐⭐) Header hide/show: ref + direct DOM transform instead of `setState`

Currently every scroll frame triggers `setIsHeaderHidden(...)` → React
re-render. Even though it's debounced via rAF, it still spends frame
budget in React. Moving to:

```ts
const headerRef = useRef<HTMLDivElement>(null);
// in scroll handler:
headerRef.current.style.transform = hidden ? 'translateY(-100%)' : '';
```

keeps the work on the compositor thread, leaving the scroll thread free
to run momentum uninterrupted.

### 4. (⭐) `overscroll-behavior: contain` on the scroll container

Stops scroll events from bubbling to parents at the edges. On iOS this
removes the secondary bounce after the inner content already bounced.

### 5. (⭐) Audit other code for main-thread work during scroll

Things to check:
- webcam image refresh ticks
- weather pill recomputation
- any `Date.now()`-driven state in client components

If any of these run on a scroll-aligned interval and synchronously block
the main thread for >8ms, momentum stutters.
