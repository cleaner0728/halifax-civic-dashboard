"use client";

import { useEffect } from "react";

// Hosts Google's hidden Translate widget at the document level so menu
// components that drive translation can mount/unmount freely without
// tearing down the widget. The widget script writes into a global root
// element by id, so this element must outlive any consumer UI.
//
// Why the widget at all (rather than the obvious `*.translate.goog`
// proxy): this is a Next.js 16 page where ~40% of the served HTML is
// RSC streaming payload (`__next_f.push(...)`). Google's proxy can't
// parse that and returns "Can't translate this page" for every target.
// The widget translates the live DOM in-place, no proxy involved. It
// was deprecated in 2019 but Google still hosts it and it still works
// in 2026 — there's no API replacement.

const WIDGET_SCRIPT_ID = "gt-widget-script";
export const WIDGET_ROOT_ID = "google_translate_element";

// Google Translate rewrites the live DOM, wrapping text nodes in <font> tags
// and relocating them. When React later tries to reconcile a list (e.g. the
// user re-filters the events feed), it calls removeChild/insertBefore against
// the node positions it remembers — but Translate has since moved those nodes,
// so the browser throws "NotFoundError: node is not a child of this node" and
// the whole subtree crashes. This is the long-standing React + Google Translate
// conflict (facebook/react#11538). Since this app intentionally ships Translate
// across the entire UI, we install the community-standard guard: make
// removeChild/insertBefore no-op gracefully when the node isn't where React
// thinks it is, instead of throwing. React's virtual DOM stays the source of
// truth; the orphaned <font> wrappers Translate left behind are simply ignored.
type GuardedWindow = Window & { __gtDomGuards?: boolean };

function installTranslateDomGuards() {
  const w = window as GuardedWindow;
  if (w.__gtDomGuards) return;
  w.__gtDomGuards = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

export default function GoogleTranslateMount() {
  useEffect(() => {
    // Install the DOM guards before anything can trigger a translated-node
    // reconciliation, regardless of whether the widget script is already loaded.
    installTranslateDomGuards();

    if (document.getElementById(WIDGET_SCRIPT_ID)) return;

    type GTWindow = Window & {
      googleTranslateElementInit?: () => void;
      google?: {
        translate?: {
          TranslateElement?: new (config: object, rootId: string) => unknown;
        };
      };
    };
    const w = window as GTWindow;
    w.googleTranslateElementInit = () => {
      const ctor = w.google?.translate?.TranslateElement;
      if (!ctor) return;
      new ctor({ pageLanguage: "en", autoDisplay: false }, WIDGET_ROOT_ID);
    };

    const s = document.createElement("script");
    s.id = WIDGET_SCRIPT_ID;
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.head.appendChild(s);
  }, []);

  // Position/visibility enforced in globals.css so the inserted iframe +
  // select never render visibly. The widget script writes into this div.
  return <div id={WIDGET_ROOT_ID} aria-hidden />;
}
