import { useLayoutEffect, useRef } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

export interface DragData {
  kind: "tab" | "section" | "item" | "column" | "task";
  id: string;
  container: string;
  version: number;
  canSchedule?: boolean;
}

type DropMode = "self" | "inside" | "grid" | "horizontal" | "vertical";
type DropPosition = "inside" | "before" | "after";

interface Point {
  clientX: number;
  clientY: number;
}

interface Destination {
  modeFor: (drag: DragData) => DropMode | undefined;
  onDrop: (drag: DragData, position: DropPosition) => void;
}

const cardSelector = "[data-drag-card]";
const sourceSelector = "[data-drag-source]";
const boardSelector = "[data-drag-board]";
const controls =
  "button,a,input,select,textarea,label,summary,[contenteditable=true]";
const destinations = new WeakMap<HTMLElement, Destination>();
const snapshots = new WeakMap<
  HTMLElement,
  { time: number; positions: Map<string, DOMRect> }
>();
const touchHoldDuration = 270;
const dragThreshold = 5;
const touchScrollThreshold = 8;
let cancelGesture: (() => void) | undefined;

function position(element: HTMLElement, point: Point, mode: DropMode) {
  if (mode === "inside") return { order: "inside", marker: "inside" } as const;
  const rect = element.getBoundingClientRect();
  const horizontal =
    mode === "horizontal" ||
    (mode === "grid" &&
      rect.width < (element.parentElement?.clientWidth ?? 0) * 0.85);
  const before = horizontal
    ? point.clientX < rect.left + rect.width / 2
    : point.clientY < rect.top + rect.height / 2;
  return {
    order: before ? "before" : "after",
    marker: horizontal
      ? before
        ? "left"
        : "right"
      : before
        ? "top"
        : "bottom",
  } as const;
}

function locate(point: Point, drag: DragData) {
  for (
    let element = document.elementFromPoint(point.clientX, point.clientY);
    element;
    element = element.parentElement
  ) {
    if (!(element instanceof HTMLElement)) continue;
    const destination = destinations.get(element);
    const mode = destination?.modeFor(drag);
    if (destination && mode) return { element, destination, mode };
  }
}

function rememberPositions(target: HTMLElement) {
  const board = target.closest<HTMLElement>(boardSelector);
  if (!board || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return;
  const positions = new Map<string, DOMRect>();
  for (const card of board.querySelectorAll<HTMLElement>(cardSelector)) {
    positions.set(card.dataset.dragCard!, card.getBoundingClientRect());
  }
  snapshots.set(board, { positions, time: performance.now() });
}

function startGesture(
  source: HTMLElement,
  drag: DragData,
  initial: Point,
  pointerId: number,
  pointerType: string,
) {
  cancelGesture?.();
  const touch = pointerType === "touch";
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let point = initial;
  let preview: HTMLElement | undefined;
  let target: HTMLElement | undefined;
  let frame = 0;
  let lastFrameTime = 0;
  let touchTimer: number | undefined;

  function showDestination() {
    const next = locate(point, drag);
    const element = next?.mode === "self" ? undefined : next?.element;
    if (target !== element) target?.removeAttribute("data-drop-position");
    target = element;
    if (target && next) {
      const { marker } = position(target, point, next.mode);
      if (target.dataset.dropPosition !== marker)
        target.dataset.dropPosition = marker;
    }
  }

  function stop() {
    window.clearTimeout(touchTimer);
    window.cancelAnimationFrame(frame);
    listeners.abort();
    if (preview) {
      preview.remove();
      source.removeAttribute("data-dragging");
      target?.removeAttribute("data-drop-position");
      document.documentElement.removeAttribute("data-drag-active");
    }
    cancelGesture = undefined;
  }

  function clearClickSuppression() {
    document.removeEventListener("click", suppressClick, true);
    document.removeEventListener("pointerdown", clearClickSuppression, true);
  }

  function suppressClick(event: MouseEvent) {
    if (!event.detail) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearClickSuppression();
  }

  function move(next: Point) {
    point = next;
    if (preview) return;
    const distance = Math.hypot(
      next.clientX - initial.clientX,
      next.clientY - initial.clientY,
    );
    if (touch) {
      if (distance > touchScrollThreshold) stop();
    } else if (distance >= dragThreshold) {
      lift();
    }
  }

  function release(end: Point) {
    const hit = preview && locate(end, drag);
    if (hit && hit.mode !== "self") rememberPositions(hit.element);
    stop();
    if (hit && hit.mode !== "self")
      hit.destination.onDrop(drag, position(hit.element, end, hit.mode).order);
  }

  function lift() {
    if (!source.isConnected) {
      stop();
      return;
    }
    const board = source.closest<HTMLElement>(boardSelector);
    if (board) snapshots.delete(board);
    const rect = source.getBoundingClientRect();
    const offsetX = initial.clientX - rect.left;
    const offsetY = Math.min(initial.clientY - rect.top, 130);
    preview = source.cloneNode(true) as HTMLElement;
    preview.classList.add("drag-preview");
    preview.removeAttribute("id");
    preview.removeAttribute("data-drag-card");
    preview.removeAttribute("data-drag-source");
    preview.removeAttribute("data-search-match");
    for (const element of preview.querySelectorAll("[id]"))
      element.removeAttribute("id");
    preview.setAttribute("aria-hidden", "true");
    preview.inert = true;
    preview.style.width = rect.width + "px";
    document.body.append(preview);
    source.dataset.dragging = "true";
    // The context-menu trigger also watches long touches. Hand the gesture over to dragging.
    if (pointerType !== "mouse")
      source.dispatchEvent(
        new PointerEvent("pointercancel", { bubbles: true, pointerType }),
      );
    document.documentElement.dataset.dragActive = "true";
    // A release after a drag may generate a click. A new press starts a fresh gesture.
    document.addEventListener("click", suppressClick, true);
    document.addEventListener("pointerdown", clearClickSuppression, true);

    function draw(time: number) {
      if (!preview) return;
      const elapsed = lastFrameTime ? Math.min(time - lastFrameTime, 32) : 0;
      lastFrameTime = time;
      const edge = 55;
      const speed = (coordinate: number, size: number) =>
        coordinate < edge
          ? coordinate - edge
          : Math.max(0, coordinate - (size - edge));
      const scrollY = (speed(point.clientY, window.innerHeight) * elapsed) / 70;
      if (scrollY) window.scrollBy(0, scrollY);
      const tabs = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest<HTMLElement>(".tabs");
      if (tabs) {
        const strip = tabs.getBoundingClientRect();
        tabs.scrollLeft +=
          (speed(point.clientX - strip.left, strip.width) * elapsed) / 70;
      }
      preview.style.transform = `translate3d(${point.clientX - offsetX}px, ${point.clientY - offsetY - 4}px, 0) scale(1.015)`;
      showDestination();
      frame = window.requestAnimationFrame(draw);
    }
    frame = window.requestAnimationFrame(draw);
  }

  if (touch) touchTimer = window.setTimeout(lift, touchHoldDuration);

  cancelGesture = stop;
  window.addEventListener("blur", stop, options);
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        if (preview) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        stop();
      }
    },
    { ...options, capture: true },
  );
  document.addEventListener(
    "contextmenu",
    (event) => {
      if (touch || preview) event.preventDefault();
    },
    { ...options, capture: true },
  );
  if (touch) {
    const findTouch = (event: TouchEvent) =>
      Array.from(event.changedTouches).find(
        (contact) => contact.identifier === pointerId,
      );
    document.addEventListener(
      "touchmove",
      (event) => {
        const next = findTouch(event);
        if (!next) return;
        if (preview && event.cancelable) event.preventDefault();
        move(next);
      },
      { ...options, passive: false },
    );
    document.addEventListener(
      "touchend",
      (event) => {
        const end = findTouch(event);
        if (!end) return;
        if (preview && event.cancelable) event.preventDefault();
        release(end);
      },
      { ...options, passive: false },
    );
    document.addEventListener("touchcancel", stop, options);
  } else {
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId !== pointerId) return;
        if (event.buttons & 1) move(event);
        else stop();
      },
      options,
    );
    window.addEventListener(
      "pointerup",
      (event) => {
        if (event.pointerId === pointerId) release(event);
      },
      options,
    );
    window.addEventListener(
      "pointercancel",
      (event) => {
        if (event.pointerId === pointerId) stop();
      },
      options,
    );
  }
}

function onSurface(
  target: EventTarget,
  element: HTMLElement,
  allowTrigger: boolean,
) {
  if (
    !(target instanceof Element) ||
    target.closest(sourceSelector) !== element
  )
    return false;
  const control = target.closest(controls);
  return (
    !control || (allowTrigger && control.hasAttribute("data-drag-trigger"))
  );
}

export function dragSource(data: DragData, onActivate?: () => void) {
  return {
    "data-drag-source": "",
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (
        event.button === 0 &&
        event.isPrimary &&
        event.pointerType !== "touch" &&
        onSurface(event.target, event.currentTarget, true)
      )
        startGesture(
          event.currentTarget,
          data,
          event,
          event.pointerId,
          event.pointerType,
        );
    },
    onTouchStart(event: ReactTouchEvent<HTMLElement>) {
      const contact = event.changedTouches[0];
      if (
        event.touches.length === 1 &&
        contact &&
        onSurface(event.target, event.currentTarget, true)
      )
        startGesture(
          event.currentTarget,
          data,
          contact,
          contact.identifier,
          "touch",
        );
    },
    onDragStart(event: ReactMouseEvent<HTMLElement>) {
      event.preventDefault();
    },
    onClick(event: ReactMouseEvent<HTMLElement>) {
      if (onActivate && onSurface(event.target, event.currentTarget, false))
        onActivate();
    },
  };
}

export function dropTarget(
  modeFor: Destination["modeFor"],
  onDrop: Destination["onDrop"],
) {
  return {
    ref(element: HTMLElement | null) {
      if (!element) return;
      destinations.set(element, { modeFor, onDrop });
      return () => {
        destinations.delete(element);
      };
    },
  };
}

export function insertionIndex(target: number, source: number, after: boolean) {
  return target + Number(after) - Number(source >= 0 && source < target);
}

export function useDragMotion<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const board = ref.current;
    const snapshot = board && snapshots.get(board);
    if (!board || !snapshot) return;
    if (performance.now() - snapshot.time > 2000) {
      snapshots.delete(board);
      return;
    }
    const shifts = new Map<HTMLElement, { x: number; y: number }>();
    for (const card of board.querySelectorAll<HTMLElement>(cardSelector)) {
      const previous = snapshot.positions.get(card.dataset.dragCard!);
      if (!previous) continue;
      const current = card.getBoundingClientRect();
      shifts.set(card, {
        x: previous.left - current.left,
        y: previous.top - current.top,
      });
    }
    if (![...shifts.values()].some(({ x, y }) => x || y)) return;
    snapshots.delete(board);
    for (const [card, shift] of shifts) {
      const parent = card.parentElement?.closest<HTMLElement>(cardSelector);
      const parentShift = parent && shifts.get(parent);
      const x = shift.x - (parentShift ? parentShift.x : 0);
      const y = shift.y - (parentShift ? parentShift.y : 0);
      if (x || y)
        card.animate?.(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }],
          { duration: 220, easing: "ease-out" },
        );
    }
  });
  return ref;
}
