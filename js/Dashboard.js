/** Телефон в альбомной ориентации тоже остаётся одним столбцом. */
const MOBILE_WIDTH = 980;

/**
 * Мозаика окон: общий край двигает оба соседних модуля,
 * свободное место сразу забирает сосед.
 */
export class Dashboard {
  #host;
  #types;
  #widgets = [];
  #empty;
  #frame = null;
  #tree = null;
  #tuned = false;
  #narrow = false;
  #narrowHeights = new Map();
  #stackOrder = "";
  #observer;

  constructor(host, types) {
    if (!host) {
      throw new Error("Для панели нужен контейнер");
    }

    this.#host = host;
    this.#types = types;
    this.#empty = document.createElement("p");
    this.#empty.className = "dashboard__empty";
    this.#empty.textContent = "Окон нет. Добавьте модуль кнопкой «+».";
    this.#host.append(this.#empty);

    this.#observer = new ResizeObserver(() => {
      const narrow = this.#host.clientWidth < MOBILE_WIDTH
        || window.matchMedia(`(max-width: ${MOBILE_WIDTH - 1}px)`).matches;
      if (narrow !== this.#narrow) {
        this.#narrow = narrow;
        this.#narrowHeights.clear();
        this.#stackOrder = "";
      }
      this.#paint();
    });
    this.#observer.observe(this.#host);
  }

  get widgets() {
    return [...this.#widgets];
  }

  sync(frame) {
    this.#frame = frame;
    for (const widget of this.#widgets) {
      widget.sync?.(frame);
    }
  }

  addWidget(widgetType) {
    const WidgetClass = this.#types[widgetType];
    if (!WidgetClass) {
      throw new Error(`Неизвестный тип виджета: ${widgetType}`);
    }

    const widget = new WidgetClass({
      onClose: (widgetId) => this.removeWidget(widgetId),
      onMove: (widgetId, targetId, after, axis) => this.moveWidget(widgetId, targetId, after, axis),
      onNudge: (widgetId, key) => this.nudgeWidget(widgetId, key),
      onResize: (widgetId, edge, dx, dy) => this.resizeWidget(widgetId, edge, dx, dy),
      onRelayout: () => this.#paint(),
    });

    this.#widgets.push(widget);
    this.#host.append(widget.render());
    this.#insert(widget.id);
    if (this.#frame) {
      widget.sync?.(this.#frame);
    }
    this.#empty.hidden = true;
    this.#paint();
    return widget;
  }

  removeWidget(widgetId) {
    const index = this.#widgets.findIndex((widget) => widget.id === widgetId);
    if (index === -1) {
      return;
    }

    const [widget] = this.#widgets.splice(index, 1);
    this.#tree = removeLeaf(this.#tree, widgetId);
    this.#narrowHeights.delete(widgetId);
    this.#stackOrder = "";
    widget.destroy();
    this.#empty.hidden = this.#widgets.length > 0;
    this.#paint();
  }

  moveWidget(widgetId, targetId, after = true, axis = "col") {
    if (!this.#tree || widgetId === targetId) {
      return;
    }
    const ids = leafIds(this.#tree);
    if (!ids.includes(widgetId) || !ids.includes(targetId)) {
      return;
    }

    this.#tuned = true;
    this.#tree = removeLeaf(this.#tree, widgetId);
    const dir = axis === "row" ? "row" : "col";
    const first = after ? leaf(targetId) : leaf(widgetId);
    const second = after ? leaf(widgetId) : leaf(targetId);
    this.#tree = replaceLeaf(this.#tree, targetId, split(dir, 0.5, first, second));
    this.#stackOrder = "";
    this.#paint();
  }

  nudgeWidget(widgetId, key) {
    const rects = this.#measure();
    const self = rects.get(widgetId);
    if (!self) {
      return;
    }

    let bestId = null;
    let bestScore = Infinity;
    for (const [id, rect] of rects) {
      if (id === widgetId) {
        continue;
      }
      const score = neighborScore(self, rect, key);
      if (score !== null && score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    if (bestId) {
      const after = key === "ArrowRight" || key === "ArrowDown";
      const axis = key === "ArrowUp" || key === "ArrowDown" ? "row" : "col";
      this.moveWidget(widgetId, bestId, after, axis);
    }
  }

  resizeWidget(widgetId, edge, dx, dy) {
    if (!this.#tree) {
      return;
    }

    const widget = this.#widgets.find((item) => item.id === widgetId);
    if (widget?.element?.classList.contains("is-fullscreen")) {
      return;
    }

    this.#tuned = true;
    if (this.#narrow) {
      this.#resizeNarrow(widgetId, edge, dy);
      return;
    }

    const boundary = findBoundary(this.#tree, widgetId, edge);
    if (!boundary) {
      return;
    }

    const host = this.#host.getBoundingClientRect();
    const along = boundary.dir === "col" ? host.width : host.height;
    const parentSize = (along * boundary.span) / 100;
    const delta = boundary.dir === "col" ? dx : dy;
    if (!parentSize) {
      return;
    }

    const minRatio = Math.min(0.42, 120 / parentSize);
    boundary.node.ratio = clamp(boundary.node.ratio + delta / parentSize, minRatio, 1 - minRatio);
    this.#paint();
  }

  #insert(widgetId) {
    if (!this.#tuned && this.#applyPreset()) {
      return;
    }

    this.#tuned = true;
    if (!this.#tree) {
      this.#tree = leaf(widgetId);
      return;
    }

    const rects = this.#measure();
    let bestId = null;
    let bestArea = -1;
    for (const [id, rect] of rects) {
      const area = rect.w * rect.h;
      if (area > bestArea) {
        bestArea = area;
        bestId = id;
      }
    }

    const target = rects.get(bestId);
    const dir = target.w >= target.h ? "col" : "row";
    this.#tree = replaceLeaf(this.#tree, bestId, split(dir, 0.5, leaf(bestId), leaf(widgetId)));
    this.#stackOrder = "";
  }

  #applyPreset() {
    const key = this.#widgets.map((widget) => widget.kind).join("+");
    const byKind = new Map(this.#widgets.map((widget) => [widget.kind, widget.id]));
    const id = (kind) => byKind.get(kind);
    const presets = {
      lidar: () => leaf(id("lidar")),
      "lidar+camera": () => split("col", 0.5, leaf(id("lidar")), leaf(id("camera"))),
      "lidar+camera+chart": () => split(
        "col",
        0.5,
        leaf(id("lidar")),
        split("row", 0.5, leaf(id("camera")), leaf(id("chart"))),
      ),
      "lidar+camera+chart+sensors": () => split(
        "col",
        0.5,
        leaf(id("lidar")),
        split(
          "row",
          0.46,
          leaf(id("camera")),
          split("col", 0.5, leaf(id("chart")), leaf(id("sensors"))),
        ),
      ),
      "lidar+camera+diagnostics": () => split(
        "col",
        0.358,
        leaf(id("lidar")),
        split("row", 0.46, leaf(id("camera")), leaf(id("diagnostics"))),
      ),
      "lidar+camera+diagnostics+variables": () => split(
        "col",
        0.358,
        leaf(id("lidar")),
        split(
          "col",
          0.37,
          split("row", 0.46, leaf(id("camera")), leaf(id("diagnostics"))),
          leaf(id("variables")),
        ),
      ),
      "lidar+camera+diagnostics+variables+battery": () => split(
        "col",
        0.358,
        leaf(id("lidar")),
        split(
          "col",
          0.37,
          split("row", 0.46, leaf(id("camera")), leaf(id("diagnostics"))),
          split("col", 0.566, leaf(id("variables")), leaf(id("battery"))),
        ),
      ),
      "lidar+camera+diagnostics+variables+battery+console": () => split(
        "col",
        0.358,
        leaf(id("lidar")),
        split(
          "col",
          0.37,
          split("row", 0.46, leaf(id("camera")), leaf(id("diagnostics"))),
          split(
            "col",
            0.566,
            leaf(id("variables")),
            split("row", 0.5, leaf(id("battery")), leaf(id("console"))),
          ),
        ),
      ),
      "lidar+camera+diagnostics+variables+battery+console+chart": () => split(
        "col",
        0.358,
        leaf(id("lidar")),
        split(
          "col",
          0.37,
          split("row", 0.46, leaf(id("camera")), leaf(id("diagnostics"))),
          split(
            "row",
            0.58,
            split(
              "col",
              0.566,
              leaf(id("variables")),
              split("row", 0.5, leaf(id("battery")), leaf(id("console"))),
            ),
            leaf(id("chart")),
          ),
        ),
      ),
    };

    const build = presets[key];
    if (!build) {
      return false;
    }

    this.#tree = build();
    return true;
  }

  #resizeNarrow(widgetId, edge, dy) {
    if (edge !== "n" && edge !== "s") {
      return;
    }

    const widget = this.#widgets.find((item) => item.id === widgetId);
    const element = widget?.element;
    if (!element) {
      return;
    }

    const visual = widget.kind === "lidar" || widget.kind === "camera";
    const delta = edge === "s" ? dy : -dy;
    const current = element.getBoundingClientRect().height;
    const floor = visual ? 160 : this.#contentHeight(element);
    const next = Math.round(Math.max(floor, current + delta));
    this.#narrowHeights.set(widgetId, next);
    element.style.height = `${next}px`;
  }

  #contentHeight(element) {
    const header = element.querySelector(".widget__header");
    const body = element.querySelector(".widget__body");
    if (!header || !body) {
      return 120;
    }
    return Math.ceil(header.offsetHeight + body.scrollHeight + 2);
  }

  #measure() {
    const rects = new Map();
    if (!this.#tree) {
      return rects;
    }

    if (this.#narrow) {
      const ids = leafIds(this.#tree);
      const heights = ids.map((id) => {
        const element = this.#widgets.find((widget) => widget.id === id)?.element;
        return element?.offsetHeight || 1;
      });
      const sum = heights.reduce((total, height) => total + height, 0) || 1;
      let y = 0;
      ids.forEach((id, index) => {
        const h = (heights[index] / sum) * 100;
        rects.set(id, { x: 0, y, w: 100, h });
        y += h;
      });
      return rects;
    }

    layout(this.#tree, { x: 0, y: 0, w: 100, h: 100 }, rects);
    return rects;
  }

  #paint() {
    const stack = this.#narrow && this.#tree;
    this.#host.classList.toggle("dashboard--stack", Boolean(stack));
    if (stack) {
      this.#paintStack();
      return;
    }

    const rects = this.#measure();
    for (const widget of this.#widgets) {
      const rect = rects.get(widget.id);
      const element = widget.element;
      if (!rect || !element || element.classList.contains("is-fullscreen")) {
        continue;
      }
      element.style.left = `calc(${rect.x}% + 4px)`;
      element.style.top = `calc(${rect.y}% + 4px)`;
      element.style.width = `calc(${rect.w}% - 8px)`;
      element.style.height = `calc(${rect.h}% - 8px)`;
    }
  }

  #paintStack() {
    const ids = leafIds(this.#tree);
    const order = ids.join(",");
    if (order !== this.#stackOrder) {
      this.#stackOrder = order;
      for (const id of ids) {
        const element = this.#widgets.find((widget) => widget.id === id)?.element;
        if (element) {
          this.#host.append(element);
        }
      }
    }

    for (const widget of this.#widgets) {
      const element = widget.element;
      if (!element || element.classList.contains("is-fullscreen")) {
        continue;
      }
      element.style.left = "";
      element.style.top = "";
      element.style.width = "";
      const custom = this.#narrowHeights.get(widget.id);
      element.style.height = custom ? `${custom}px` : "";
    }
  }
}

function leaf(id) {
  return { type: "leaf", id };
}

function split(dir, ratio, a, b) {
  return { type: "split", dir, ratio, a, b };
}

function layout(node, rect, out) {
  if (!node) {
    return;
  }
  if (node.type === "leaf") {
    out.set(node.id, rect);
    return;
  }

  if (node.dir === "col") {
    const width = rect.w * node.ratio;
    layout(node.a, { x: rect.x, y: rect.y, w: width, h: rect.h }, out);
    layout(node.b, { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h }, out);
    return;
  }

  const height = rect.h * node.ratio;
  layout(node.a, { x: rect.x, y: rect.y, w: rect.w, h: height }, out);
  layout(node.b, { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height }, out);
}

function replaceLeaf(node, id, next) {
  if (!node) {
    return next;
  }
  if (node.type === "leaf") {
    return node.id === id ? next : node;
  }
  node.a = replaceLeaf(node.a, id, next);
  node.b = replaceLeaf(node.b, id, next);
  return node;
}

function removeLeaf(node, id) {
  if (!node) {
    return null;
  }
  if (node.type === "leaf") {
    return node.id === id ? null : node;
  }
  node.a = removeLeaf(node.a, id);
  node.b = removeLeaf(node.b, id);
  if (!node.a) {
    return node.b;
  }
  if (!node.b) {
    return node.a;
  }
  return node;
}

function leafIds(node, into = []) {
  if (!node) {
    return into;
  }
  if (node.type === "leaf") {
    into.push(node.id);
    return into;
  }
  leafIds(node.a, into);
  leafIds(node.b, into);
  return into;
}

function findBoundary(tree, id, edge) {
  const horizontal = edge === "e" || edge === "w";
  const wantDir = horizontal ? "col" : "row";
  const wantSide = edge === "e" || edge === "s" ? "a" : "b";
  let match = null;

  const visit = (side, node, span) => {
    if (!match && node.dir === wantDir && side === wantSide) {
      match = { node, dir: node.dir, span };
    }
  };

  const walk = (node, rect) => {
    if (!node) {
      return false;
    }
    if (node.type === "leaf") {
      return node.id === id;
    }

    if (node.dir === "col") {
      const width = rect.w * node.ratio;
      if (walk(node.a, { x: rect.x, y: rect.y, w: width, h: rect.h })) {
        visit("a", node, rect.w);
        return true;
      }
      if (walk(node.b, { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h })) {
        visit("b", node, rect.w);
        return true;
      }
      return false;
    }

    const height = rect.h * node.ratio;
    if (walk(node.a, { x: rect.x, y: rect.y, w: rect.w, h: height })) {
      visit("a", node, rect.h);
      return true;
    }
    if (walk(node.b, { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height })) {
      visit("b", node, rect.h);
      return true;
    }
    return false;
  };

  walk(tree, { x: 0, y: 0, w: 100, h: 100 });
  return match;
}

function neighborScore(self, rect, key) {
  const overlapY = Math.min(self.y + self.h, rect.y + rect.h) - Math.max(self.y, rect.y);
  const overlapX = Math.min(self.x + self.w, rect.x + rect.w) - Math.max(self.x, rect.x);

  if (key === "ArrowRight") {
    const gap = rect.x - (self.x + self.w);
    if (gap > 2.5 || gap < -1 || overlapY < 4) {
      return null;
    }
    return gap + (100 - overlapY) * 0.01;
  }
  if (key === "ArrowLeft") {
    const gap = self.x - (rect.x + rect.w);
    if (gap > 2.5 || gap < -1 || overlapY < 4) {
      return null;
    }
    return gap + (100 - overlapY) * 0.01;
  }
  if (key === "ArrowDown") {
    const gap = rect.y - (self.y + self.h);
    if (gap > 2.5 || gap < -1 || overlapX < 4) {
      return null;
    }
    return gap + (100 - overlapX) * 0.01;
  }
  if (key === "ArrowUp") {
    const gap = self.y - (rect.y + rect.h);
    if (gap > 2.5 || gap < -1 || overlapX < 4) {
      return null;
    }
    return gap + (100 - overlapX) * 0.01;
  }
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
