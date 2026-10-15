import { UIComponent } from "./UIComponent.js";
import { heatColor } from "./heatmap.js";
import { castRay } from "./data/scene.js";
import { icon } from "./icons.js";

const ELEVATIONS = [-0.16, -0.06, 0, 0.05];

/**
 * Облако PointCloud2. Курсор возвращает обычные кнопки мыши:
 * левая сдвигает вид, правая вращает камеру.
 */
export class LidarWidget extends UIComponent {
  #canvas;
  #scale;
  #note;
  #frame;
  #rings = true;
  #legend = true;
  #context = null;
  #cloudKey = "";
  #points = [];
  #yaw = 0.55;
  #pitch = 1.05;
  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #toolMode = "cursor";
  #drag = null;

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ лидар", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "lidar" });
  }

  createBody() {
    const wrap = document.createElement("div");
    wrap.className = "lidar";

    const tools = document.createElement("div");
    tools.className = "lidar__tools";
    tools.setAttribute("role", "group");
    tools.setAttribute("aria-label", "Управление видом лидара");
    tools.append(
      this.#tool("Курсор", "cursor"),
      this.#tool("Перемещение", "move"),
      this.#tool("Масштаб", "scale"),
      this.#tool("Наклон", "tilt"),
      this.#command("Оцентровать по осям машины", "crosshair", () => this.#frameAxes()),
    );

    const stage = document.createElement("div");
    stage.className = "lidar__stage";

    const canvas = document.createElement("canvas");
    canvas.className = "lidar__view";
    canvas.tabIndex = 0;
    canvas.dataset.tool = "cursor";
    canvas.setAttribute("aria-label", "Облако точек. Левая кнопка сдвигает вид, правая вращает камеру.");

    const scale = document.createElement("div");
    scale.className = "lidar__scale";
    scale.setAttribute("aria-hidden", "true");

    const note = document.createElement("p");
    note.className = "lidar__note";
    const near = document.createElement("span");
    near.textContent = "ближе";
    const far = document.createElement("span");
    far.textContent = "дальше";
    note.append(near, far);

    stage.append(canvas, tools);
    wrap.append(stage, scale, note);
    this.#canvas = canvas;
    this.#scale = scale;
    this.#note = note;
    this.#bindView(canvas);
    const themeWatch = new MutationObserver(() => {
      this.#cloudKey = "";
      if (this.#frame) {
        this.#draw(this.#frame);
      }
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.trackObserver(themeWatch);
    return wrap;
  }

  createSettings() {
    const box = document.createElement("div");
    box.className = "settings";
    box.append(
      this.#toggle("Кольца сетки", () => this.#rings, (value) => {
        this.#rings = value;
      }),
      this.#toggle("Шкала дистанции", () => this.#legend, (value) => {
        this.#legend = value;
        this.#scale.hidden = !value;
        this.#note.hidden = !value;
      }),
    );
    return box;
  }

  #command(label, glyph, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lidar__tool";
    button.setAttribute("aria-label", label);
    button.append(icon(glyph));
    this.listen(button, "click", onClick);
    return button;
  }

  #tool(label, mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lidar__tool";
    button.dataset.mode = mode;
    button.setAttribute("aria-label", label);
    const glyphs = { cursor: "cursor", move: "move", scale: "zoom", tilt: "tilt" };
    button.append(icon(glyphs[mode]));
    button.setAttribute("aria-pressed", String(mode === this.#toolMode));
    this.listen(button, "click", () => this.#setTool(mode));
    return button;
  }

  #setTool(mode) {
    this.#toolMode = mode;
    const hints = {
      cursor: "Облако точек. Левая кнопка сдвигает вид, правая вращает камеру.",
      move: "Облако точек. Инструмент «Перемещение»: левая кнопка сдвигает вид, правая вращает камеру.",
      scale: "Облако точек. Инструмент «Масштаб»: левая кнопка меняет масштаб, правая вращает камеру.",
      tilt: "Облако точек. Инструмент «Наклон»: левая и правая кнопки вращают камеру.",
    };
    this.#canvas.dataset.tool = mode;
    this.#canvas.setAttribute("aria-label", hints[mode]);
    this.#canvas.closest(".lidar")?.querySelectorAll(".lidar__tool[data-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });
  }

  #toggle(label, read, write) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = read();
    this.listen(input, "change", () => {
      write(input.checked);
      if (this.#frame) {
        this.#draw(this.#frame);
      }
    });
    const row = document.createElement("label");
    row.className = "settings__row";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(input, text);
    return row;
  }

  #bindView(canvas) {
    this.listen(canvas, "pointerdown", (event) => {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      const orbit = event.button === 2 || this.#toolMode === "tilt";
      const scale = !orbit && this.#toolMode === "scale";
      this.#drag = {
        mode: orbit ? "tilt" : scale ? "scale" : "move",
        x: event.clientX,
        y: event.clientY,
      };
    });

    this.listen(canvas, "pointermove", (event) => {
      if (!this.#drag) {
        return;
      }
      const dx = event.clientX - this.#drag.x;
      const dy = event.clientY - this.#drag.y;
      this.#drag.x = event.clientX;
      this.#drag.y = event.clientY;
      if (this.#drag.mode === "tilt") {
        this.#orbitBy(dx * 0.01, dy * 0.008);
        return;
      }
      if (this.#drag.mode === "scale") {
        this.#zoomBy(Math.exp(-dy * 0.012));
        return;
      }
      this.#panX += dx;
      this.#panY += dy;
      if (this.#frame) {
        this.#draw(this.#frame);
      }
    });

    const endDrag = () => {
      this.#drag = null;
    };
    this.listen(canvas, "pointerup", endDrag);
    this.listen(canvas, "pointercancel", endDrag);
    this.listen(canvas, "contextmenu", (event) => event.preventDefault());
    this.listen(canvas, "wheel", (event) => {
      event.preventDefault();
      this.#zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
    }, { passive: false });

    this.listen(canvas, "keydown", (event) => {
      const key = event.key;
      if (this.#toolMode === "scale") {
        if (key === "ArrowUp" || key === "+" || key === "=") this.#zoomBy(1.12);
        if (key === "ArrowDown" || key === "-" || key === "_") this.#zoomBy(1 / 1.12);
      } else if (this.#toolMode === "tilt" || (this.#toolMode === "cursor" && event.shiftKey)) {
        if (key === "ArrowLeft") this.#orbitBy(-0.12, 0);
        if (key === "ArrowRight") this.#orbitBy(0.12, 0);
        if (key === "ArrowUp") this.#orbitBy(0, -0.08);
        if (key === "ArrowDown") this.#orbitBy(0, 0.08);
      } else {
        const step = 18;
        if (key === "ArrowLeft") this.#panX -= step;
        if (key === "ArrowRight") this.#panX += step;
        if (key === "ArrowUp") this.#panY -= step;
        if (key === "ArrowDown") this.#panY += step;
        if (key.startsWith("Arrow") && this.#frame) {
          this.#draw(this.#frame);
        }
      }
      if (key === "1") this.#resetView();
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_", "1"].includes(key)) {
        event.preventDefault();
      }
    });
  }

  #orbitBy(yaw, pitch) {
    this.#yaw += yaw;
    this.#pitch = clamp(this.#pitch + pitch, 0.2, 1.45);
    if (this.#frame) {
      this.#draw(this.#frame);
    }
  }

  #zoomBy(factor) {
    this.#zoom = clamp(this.#zoom * factor, 0.35, 4.5);
    if (this.#frame) {
      this.#draw(this.#frame);
    }
  }

  #frameAxes() {
    this.#panX = 0;
    this.#panY = 0;
    this.#yaw = 0;
    this.#pitch = 1.15;
    if (this.#frame) {
      this.#draw(this.#frame);
    }
  }

  #resetView() {
    this.#yaw = 0.55;
    this.#pitch = 1.05;
    this.#zoom = 1;
    this.#panX = 0;
    this.#panY = 0;
    if (this.#frame) {
      this.#draw(this.#frame);
    }
  }

  sync(frame) {
    this.#frame = frame;
    if (!this.#canvas) {
      return;
    }

    this.setSubtitle(`/rover_01/velodyne_points · sensor_msgs/PointCloud2`);
    this.#draw(frame);
  }

  onBoxResize() {
    if (this.#frame) {
      this.#draw(this.#frame);
    }
  }

  #draw(frame) {
    const canvas = this.#canvas;
    const box = canvas.parentElement ?? canvas;
    const width = Math.max(box.clientWidth, 1);
    const height = Math.max(box.clientHeight, 1);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const bitmapWidth = Math.round(width * ratio);
    const bitmapHeight = Math.round(height * ratio);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const context = this.#context ?? canvas.getContext("2d", { alpha: false });
    this.#context = context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const light = document.documentElement.dataset.theme === "light";
    context.fillStyle = light ? "#d4d8e0" : "#07080c";
    context.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.min(width, height) * 0.42;
    const maxDist = frame.recording.scene === "street" ? 36 : 52;
    this.#ensureCloud(frame, maxDist);

    if (this.#rings) {
      context.strokeStyle = light ? "rgba(23, 25, 30, 0.22)" : "rgba(242, 243, 245, 0.16)";
      context.lineWidth = 1;
      for (const step of [0.33, 0.66, 1]) {
        context.beginPath();
        for (let index = 0; index <= 48; index += 1) {
          const angle = (index / 48) * Math.PI * 2;
          const point = this.#project(Math.cos(angle) * step, Math.sin(angle) * step, 0, cx, cy, maxRadius);
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.stroke();
      }
    }

    const painted = this.#points.map((point) => {
      const screen = this.#project(point.x, point.y, point.z, cx, cy, maxRadius);
      return { ...screen, color: point.color };
    });
    painted.sort((left, right) => right.depth - left.depth);
    for (const point of painted) {
      context.fillStyle = point.color;
      context.fillRect(point.x, point.y, 2.4, 2.4);
    }

    const nose = this.#project(0, 0.06, 0, cx, cy, maxRadius);
    const left = this.#project(-0.03, -0.04, 0, cx, cy, maxRadius);
    const right = this.#project(0.03, -0.04, 0, cx, cy, maxRadius);
    context.fillStyle = light ? "#0b8f58" : "#3ddc97";
    context.beginPath();
    context.moveTo(nose.x, nose.y);
    context.lineTo(right.x, right.y);
    context.lineTo(left.x, left.y);
    context.closePath();
    context.fill();
  }

  #project(x, y, z, cx, cy, radius) {
    const yaw = this.#yaw;
    const pitch = this.#pitch;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const xr = x * cosYaw - y * sinYaw;
    const yr = x * sinYaw + y * cosYaw;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const y2 = yr * cosPitch - z * sinPitch;
    const depth = yr * sinPitch + z * cosPitch;
    const perspective = 1 / (1.35 + depth * 0.55);
    const scale = radius * this.#zoom * perspective;
    return {
      x: cx + this.#panX + xr * scale,
      y: cy + this.#panY - y2 * scale,
      depth,
    };
  }

  #ensureCloud(frame, maxDist) {
    const light = document.documentElement.dataset.theme === "light";
    const key = `${frame.recording.id}:${frame.index}:${light ? "light" : "dark"}`;
    if (key === this.#cloudKey) {
      return;
    }
    this.#cloudKey = key;

    const count = 144;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      for (const elevation of ELEVATIONS) {
        const hit = castRay(angle, elevation, frame.sample.actors);
        if (!hit || hit.range > maxDist || hit.range < 0.4) {
          continue;
        }
        points.push({
          x: hit.right / maxDist,
          y: hit.forward / maxDist,
          z: hit.z / 10,
          color: heatColor(1 - hit.range / maxDist, light),
        });
      }
    }
    this.#points = points;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
