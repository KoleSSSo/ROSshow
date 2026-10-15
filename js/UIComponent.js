import { icon } from "./icons.js";
import { fitPaths } from "./pathfit.js";

const EDGES = [
  ["n", "Верхний край. Стрелки вверх и вниз меняют высоту", ["ArrowUp", "ArrowDown"]],
  ["e", "Правый край. Стрелки влево и вправо меняют ширину", ["ArrowLeft", "ArrowRight"]],
  ["s", "Нижний край. Стрелки вверх и вниз меняют высоту", ["ArrowUp", "ArrowDown"]],
  ["w", "Левый край. Стрелки влево и вправо меняют ширину", ["ArrowLeft", "ArrowRight"]],
];

let nextWidgetId = 1;

/**
 * Оболочка окна: шапка, полный экран, закрытие, параметры и размер.
 */
export class UIComponent {
  #listeners = [];
  #timers = new Set();
  #controller = new AbortController();
  #observers = new Set();
  #root = null;
  #subtitle = null;
  #settingsButton = null;
  #settingsPanel = null;
  #fullscreenButton = null;
  #fullscreen = false;
  #settingsOpen = false;
  #resize = null;
  #move = null;
  #resizeFrame = 0;
  #destroyed = false;

  constructor({ title, id, onClose, onMove, onNudge, onResize, onRelayout, kind } = {}) {
    if (new.target === UIComponent) {
      throw new Error("UIComponent абстрактный: создайте класс виджета");
    }

    this.title = title ?? "Виджет";
    this.id = id ?? `widget-${nextWidgetId}`;
    nextWidgetId += 1;
    this.onClose = onClose ?? null;
    this.onMove = onMove ?? null;
    this.onNudge = onNudge ?? null;
    this.onResize = onResize ?? null;
    this.onRelayout = onRelayout ?? null;
    this.kind = kind ?? "widget";
  }

  get signal() {
    return this.#controller.signal;
  }

  get element() {
    return this.#root;
  }

  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#listeners.push({ target, type, handler, options });
  }

  trackInterval(callback, delay) {
    const timerId = setInterval(callback, delay);
    this.#timers.add(timerId);
    return timerId;
  }

  trackObserver(observer) {
    this.#observers.add(observer);
    return observer;
  }

  setSubtitle(text) {
    if (this.#subtitle && this.#subtitle.textContent !== text) {
      this.#subtitle.textContent = text;
    }
  }

  render() {
    if (this.#root) {
      return this.#root;
    }

    const root = document.createElement("article");
    root.className = "widget";
    root.id = this.id;
    root.dataset.kind = this.kind;

    const titleId = `${this.id}-title`;
    root.setAttribute("aria-labelledby", titleId);

    const header = document.createElement("header");
    header.className = "widget__header";
    header.tabIndex = 0;
    header.setAttribute(
      "aria-label",
      `Вставить «${this.title}» между окнами. Потяните заголовок к краю другого окна. Ctrl и стрелки делают то же самое`,
    );

    const headingWrap = document.createElement("div");
    headingWrap.className = "widget__heading";

    const title = document.createElement("h2");
    title.className = "widget__title";
    title.id = titleId;
    title.textContent = this.title;

    const subtitle = document.createElement("p");
    subtitle.className = "widget__topic";
    this.#subtitle = subtitle;
    headingWrap.append(title, subtitle);

    const fullscreenButton = this.#action("На весь экран", "expand");
    fullscreenButton.setAttribute("aria-pressed", "false");
    this.listen(fullscreenButton, "click", () => this.toggleFullscreen());

    const settingsButton = this.#action("Параметры", "dots");
    settingsButton.setAttribute("aria-expanded", "false");
    settingsButton.setAttribute("aria-controls", `${this.id}-settings`);
    this.listen(settingsButton, "click", (event) => {
      event.stopPropagation();
      this.#toggleSettings();
    });

    const closeButton = this.#action("Закрыть", "close");
    closeButton.classList.add("widget__action--close");
    this.listen(closeButton, "click", () => this.close());

    const actions = document.createElement("div");
    actions.className = "widget__actions";
    actions.append(fullscreenButton, settingsButton, closeButton);

    const settings = document.createElement("div");
    settings.className = "widget__settings";
    settings.id = `${this.id}-settings`;
    settings.hidden = true;
    const settingsBody = this.createSettings();
    if (settingsBody) {
      settings.append(settingsBody);
    }

    header.append(headingWrap, actions);
    this.#bindMove(header);

    const body = document.createElement("div");
    body.className = "widget__body";
    body.id = `${this.id}-body`;
    const content = this.createBody();
    if (content) {
      body.append(content);
    }

    root.append(header, settings, body);
    for (const [edge, label, keys] of EDGES) {
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = `widget__edge widget__edge--${edge}`;
      handle.setAttribute("aria-label", label);
      this.#bindEdge(handle, edge, keys);
      root.append(handle);
    }

    this.listen(document, "pointerdown", (event) => {
      if (!this.#settingsOpen || this.#settingsPanel?.contains(event.target) || settingsButton.contains(event.target)) {
        return;
      }
      this.#toggleSettings(false);
    });

    this.listen(document, "keydown", (event) => {
      if (event.key === "Escape" && this.#settingsOpen) {
        this.#toggleSettings(false);
        settingsButton.focus();
      }
    });

    this.#root = root;
    this.#settingsButton = settingsButton;
    this.#settingsPanel = settings;
    this.#fullscreenButton = fullscreenButton;
    this.#observeBox(body);
    return root;
  }

  #action(label, iconName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "widget__action";
    button.setAttribute("aria-label", label);
    button.append(icon(iconName));
    return button;
  }

  createBody() {
    return document.createElement("div");
  }

  createSettings() {
    const note = document.createElement("p");
    note.className = "settings__empty";
    note.textContent = "Для этого модуля отдельных параметров нет.";
    return note;
  }

  sync() {}

  onBoxResize() {}

  #toggleSettings(force) {
    this.#settingsOpen = force ?? !this.#settingsOpen;
    if (this.#settingsPanel) {
      this.#settingsPanel.hidden = !this.#settingsOpen;
    }
    this.#settingsButton?.setAttribute("aria-expanded", String(this.#settingsOpen));
  }

  #observeBox(body) {
    const observer = new ResizeObserver(() => {
      if (this.#resizeFrame) {
        return;
      }
      this.#resizeFrame = requestAnimationFrame(() => {
        this.#resizeFrame = 0;
        if (!this.#destroyed) {
          fitPaths(body);
          this.onBoxResize();
        }
      });
    });
    observer.observe(body);
    this.trackObserver(observer);
  }

  #bindEdge(handle, edge, keys) {
    this.listen(handle, "pointerdown", (event) => {
      if (this.#fullscreen || event.button !== 0) {
        return;
      }
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      this.#resize = { edge, x: event.clientX, y: event.clientY };
    });

    this.listen(handle, "pointermove", (event) => {
      if (!this.#resize || this.#resize.edge !== edge) {
        return;
      }
      const dx = event.clientX - this.#resize.x;
      const dy = event.clientY - this.#resize.y;
      if (dx === 0 && dy === 0) {
        return;
      }
      this.#resize.x = event.clientX;
      this.#resize.y = event.clientY;
      this.onResize?.(this.id, edge, dx, dy);
    });

    const endResize = () => {
      if (this.#resize?.edge === edge) {
        this.#resize = null;
      }
    };
    this.listen(handle, "pointerup", endResize);
    this.listen(handle, "pointercancel", endResize);

    this.listen(handle, "keydown", (event) => {
      if (this.#fullscreen || !keys.includes(event.key)) {
        return;
      }
      event.preventDefault();
      const step = 28;
      if (event.key === "ArrowRight") this.onResize?.(this.id, edge, step, 0);
      if (event.key === "ArrowLeft") this.onResize?.(this.id, edge, -step, 0);
      if (event.key === "ArrowDown") this.onResize?.(this.id, edge, 0, step);
      if (event.key === "ArrowUp") this.onResize?.(this.id, edge, 0, -step);
    });
  }

  #bindMove(header) {
    this.listen(header, "pointerdown", (event) => {
      if (this.#fullscreen || event.button !== 0 || event.target.closest("button")) {
        return;
      }
      header.setPointerCapture(event.pointerId);
      this.#move = { x: event.clientX, y: event.clientY, active: false, target: null, after: false, axis: "col" };
    });

    this.listen(header, "pointermove", (event) => {
      if (!this.#move) {
        return;
      }
      const distance = Math.hypot(event.clientX - this.#move.x, event.clientY - this.#move.y);
      if (!this.#move.active && distance < 6) {
        return;
      }
      this.#move.active = true;
      this.#root.classList.add("is-dragging");
      clearDropMarks();
      const place = findDrop(event.clientX, event.clientY, this.#root);
      if (!place) {
        this.#move.target = null;
        return;
      }
      this.#move.axis = place.axis;
      this.#move.after = place.after;
      this.#move.target = place.node.id;
      place.node.classList.add("is-drop", place.after ? "is-drop-after" : "is-drop-before", `is-drop-${place.axis}`);
      showDropLine(place.rect, place.axis, place.after);
    });

    const endMove = () => {
      if (this.#move?.active && this.#move.target) {
        this.onMove?.(this.id, this.#move.target, this.#move.after, this.#move.axis);
      }
      this.#move = null;
      this.#root?.classList.remove("is-dragging");
      clearDropMarks();
    };
    this.listen(header, "pointerup", endMove);
    this.listen(header, "pointercancel", endMove);

    this.listen(header, "keydown", (event) => {
      if (this.#fullscreen || (!event.ctrlKey && !event.metaKey) || !this.#root?.parentElement) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        this.onNudge?.(this.id, event.key);
      }
    });
  }

  toggleFullscreen() {
    if (!this.#root || this.#destroyed) {
      return;
    }
    this.#toggleSettings(false);
    this.#fullscreen = !this.#fullscreen;
    this.#root.classList.toggle("is-fullscreen", this.#fullscreen);
    if (this.#fullscreen) {
      this.#root.style.left = "";
      this.#root.style.top = "";
      this.#root.style.width = "";
      this.#root.style.height = "";
    }
    this.onRelayout?.();
    const label = this.#fullscreen ? "Вернуть в панель" : "На весь экран";
    this.#fullscreenButton.setAttribute("aria-label", label);
    this.#fullscreenButton.setAttribute("aria-pressed", String(this.#fullscreen));
    this.#fullscreenButton.replaceChildren(icon(this.#fullscreen ? "compress" : "expand"));
  }

  close() {
    if (this.onClose) {
      this.onClose(this.id);
      return;
    }
    this.destroy();
  }

  destroy() {
    if (this.#destroyed) {
      return;
    }
    this.#destroyed = true;
    this.#controller.abort();
    if (this.#resizeFrame) {
      cancelAnimationFrame(this.#resizeFrame);
      this.#resizeFrame = 0;
    }

    for (const timerId of this.#timers) {
      clearInterval(timerId);
    }
    this.#timers.clear();

    for (const observer of this.#observers) {
      observer.disconnect();
    }
    this.#observers.clear();

    for (const { target, type, handler, options } of this.#listeners) {
      target.removeEventListener(type, handler, options);
    }
    this.#listeners.length = 0;

    this.#root?.remove();
    this.#root = null;
    this.#subtitle = null;
    this.#settingsButton = null;
    this.#settingsPanel = null;
    this.#fullscreenButton = null;
  }
}

function clearDropMarks() {
  document.querySelectorAll(".widget.is-drop").forEach((node) => {
    node.classList.remove("is-drop", "is-drop-before", "is-drop-after", "is-drop-col", "is-drop-row");
  });
  document.querySelector(".drop-line")?.remove();
}

function findDrop(x, y, self) {
  const nodes = [...document.querySelectorAll(".widget")].filter(
    (node) => node !== self && !node.classList.contains("is-fullscreen"),
  );
  let best = null;
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    const edge = nearestEdge(x, y, rect);
    if (!edge || (!inside && edge.dist > 36)) {
      continue;
    }
    if (!best || edge.dist < best.dist) {
      best = { node, rect, axis: edge.axis, after: edge.after, dist: edge.dist };
    }
  }
  return best;
}

function nearestEdge(x, y, rect) {
  const edges = [
    { axis: "col", after: false, dist: Math.abs(x - rect.left), along: y >= rect.top - 8 && y <= rect.bottom + 8 },
    { axis: "col", after: true, dist: Math.abs(x - rect.right), along: y >= rect.top - 8 && y <= rect.bottom + 8 },
    { axis: "row", after: false, dist: Math.abs(y - rect.top), along: x >= rect.left - 8 && x <= rect.right + 8 },
    { axis: "row", after: true, dist: Math.abs(y - rect.bottom), along: x >= rect.left - 8 && x <= rect.right + 8 },
  ].filter((edge) => edge.along);
  edges.sort((left, right) => left.dist - right.dist);
  return edges[0] ?? null;
}

function showDropLine(rect, axis, after) {
  const line = document.createElement("div");
  line.className = "drop-line";
  const size = 4;
  if (axis === "col") {
    line.style.left = `${(after ? rect.right : rect.left) - size / 2}px`;
    line.style.top = `${rect.top}px`;
    line.style.width = `${size}px`;
    line.style.height = `${rect.height}px`;
  } else {
    line.style.left = `${rect.left}px`;
    line.style.top = `${(after ? rect.bottom : rect.top) - size / 2}px`;
    line.style.width = `${rect.width}px`;
    line.style.height = `${size}px`;
  }
  document.body.append(line);
}
