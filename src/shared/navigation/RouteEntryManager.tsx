import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { isApprovedRouteTarget, resolveRouteEntryDirective, targetIdFromHash, type RouteEntryLocation } from "./routeEntryPolicy";

function initialEntryIsHistoryTraversal() {
  const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return navigationEntry?.type === "back_forward";
}

function makeProgrammaticallyFocusable(element: HTMLElement) {
  if (element.matches("a[href], button, input, select, textarea, [tabindex]")) return;
  element.tabIndex = -1;
  element.dataset.routeEntryFocus = "true";
  element.addEventListener("blur", () => {
    if (element.dataset.routeEntryFocus !== "true") return;
    delete element.dataset.routeEntryFocus;
    element.removeAttribute("tabindex");
  }, { once: true });
}

function focusWithoutScrolling(element: HTMLElement) {
  makeProgrammaticallyFocusable(element);
  element.focus({ preventScroll: true });
}

function pageFocusTarget(main: HTMLElement) {
  const target = main.querySelector<HTMLElement>("[data-route-focus-target], h1");
  if (target) return target;
  return main.querySelector(".site-loading") ? null : main;
}

function targetFocusElement(target: HTMLElement) {
  if (target.matches("h1, h2, h3, h4, h5, h6")) return target;
  return target.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6") ?? target;
}

export default function RouteEntryManager() {
  const location = useLocation();
  const navigationAction = useNavigationType();
  const hasManagedEntryRef = useRef(false);
  const previousLocationRef = useRef<RouteEntryLocation | null>(null);

  useEffect(() => {
    function handleSameDocumentTarget(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin
        || destination.pathname !== window.location.pathname
        || destination.search !== window.location.search
      ) return;
      const targetId = targetIdFromHash(destination.hash);
      if (!targetId || !isApprovedRouteTarget(targetId)) return;

      // Run after the browser's native fragment default action so it cannot
      // clear the accessible heading focus we apply to the same-page target.
      requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
        focusWithoutScrolling(targetFocusElement(target));
      });
    }

    document.addEventListener("click", handleSameDocumentTarget);
    return () => document.removeEventListener("click", handleSameDocumentTarget);
  }, []);

  useLayoutEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;

    // A microtask lets React Strict Mode discard its first development-only
    // effect pass and lets redirect effects settle without an arbitrary delay.
    queueMicrotask(() => {
      if (disposed) return;

      const currentLocation: RouteEntryLocation = {
        hash: location.hash,
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      };
      const isInitialEntry = !hasManagedEntryRef.current;
      const directive = resolveRouteEntryDirective({
        initialHistoryTraversal: isInitialEntry && initialEntryIsHistoryTraversal(),
        isInitialEntry,
        location: currentLocation,
        navigationAction,
        previousLocation: previousLocationRef.current,
      });

      hasManagedEntryRef.current = true;
      previousLocationRef.current = currentLocation;
      if (directive.behavior === "preserve") return;

      const main = document.querySelector<HTMLElement>(".site-main");
      if (!main) return;

      if (directive.behavior === "top") {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        const focusPage = () => {
          const target = pageFocusTarget(main);
          if (!target || (target === main && !main.firstElementChild)) return false;
          focusWithoutScrolling(target);
          return true;
        };
        if (focusPage()) return;
        observer = new MutationObserver(() => {
          if (!focusPage()) return;
          observer?.disconnect();
          observer = null;
        });
        observer.observe(main, { childList: true, subtree: true });
        return;
      }

      const focusTarget = () => {
        const target = document.getElementById(directive.targetId);
        if (!target) return false;
        target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
        focusWithoutScrolling(targetFocusElement(target));
        return true;
      };
      if (focusTarget()) return;

      // A lazy destination may not have rendered its target yet. Keep the
      // loading state at a predictable position, then react to the real DOM.
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      observer = new MutationObserver(() => {
        if (!focusTarget()) return;
        observer?.disconnect();
        observer = null;
      });
      observer.observe(main, { childList: true, subtree: true });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, [location.hash, location.key, location.pathname, location.search, location.state, navigationAction]);

  return null;
}
