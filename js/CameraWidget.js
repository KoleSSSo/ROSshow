import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";

/** Синтетический кадр камеры. Меняется вместе с общей перемоткой. */
export class CameraWidget extends UIComponent {
  #canvas;
  #frame;
  #crosshair = true;
  #osd = true;
  #context = null;

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ камера", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "camera" });
  }

  createBody() {
    const canvas = document.createElement("canvas");
    canvas.className = "camera__feed";
    canvas.setAttribute("aria-label", "Кадр камеры rover-01");
    this.#canvas = canvas;
    return canvas;
  }

  createSettings() {
    const box = document.createElement("div");
    box.className = "settings";
    box.append(
      this.#toggle("Прицел", () => this.#crosshair, (value) => {
        this.#crosshair = value;
      }),
      this.#toggle("Подпись кадра", () => this.#osd, (value) => {
        this.#osd = value;
      }),
    );
    return box;
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

  sync(frame) {
    this.#frame = frame;
    if (!this.#canvas) {
      return;
    }

    this.setSubtitle(`/rover_01/camera/image_raw · ${frame.recording.robot}`);
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

    const context = this.#context ?? canvas.getContext("2d");
    if (!context) {
      return;
    }
    this.#context = context;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const sample = frame.sample;
    const street = frame.recording.scene === "street";
    const steer = sample.heading * 1.6;
    const horizon = height * 0.46;

    context.fillStyle = street ? "#1a1e28" : "#243044";
    context.fillRect(0, 0, width, horizon);
    context.fillStyle = "#2c3038";
    context.fillRect(0, horizon, width, height - horizon);

    context.strokeStyle = "rgba(242, 243, 245, 0.28)";
    context.lineWidth = 1.5;
    strokeLine(context, projectPoint(4, -1.7, 0, width, height, steer), projectPoint(42, -1.7, 0, width, height, steer));
    strokeLine(context, projectPoint(4, 1.7, 0, width, height, steer), projectPoint(42, 1.7, 0, width, height, steer));

    const cars = sample.actors
      .filter((actor) => actor.f1 > 0.8)
      .sort((left, right) => right.forward - left.forward);
    for (const actor of cars) {
      drawActor(context, actor, width, height, steer);
    }

    if (this.#crosshair) {
      context.strokeStyle = "rgba(61, 220, 151, 0.85)";
      context.lineWidth = 1.4;
      const cx = width / 2 + steer;
      const cy = horizon;
      context.beginPath();
      context.moveTo(cx - 10, cy);
      context.lineTo(cx + 10, cy);
      context.moveTo(cx, cy - 10);
      context.lineTo(cx, cy + 10);
      context.stroke();
    }

    if (this.#osd) {
      context.fillStyle = "rgba(8, 9, 12, 0.55)";
      context.fillRect(10, 10, 188, 44);
      context.fillStyle = "#f2f3f5";
      context.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
      context.fillText(`${formatNumber(sample.t)} с`, 20, 28);
      context.fillStyle = "rgba(242, 243, 245, 0.72)";
      context.fillText(`впереди ${formatNumber(sample.front)} м`, 20, 44);
    }
  }
}

function projectPoint(forward, right, z, width, height, steer) {
  if (forward < 0.35) {
    return null;
  }
  const focal = height * 0.9;
  return {
    u: width / 2 + (right / forward) * focal + steer,
    v: height * 0.46 - ((z - 1.25) / forward) * focal,
  };
}

function fillPoly(context, points) {
  if (points.some((point) => !point)) {
    return;
  }
  context.beginPath();
  context.moveTo(points[0].u, points[0].v);
  for (const point of points.slice(1)) {
    context.lineTo(point.u, point.v);
  }
  context.closePath();
  context.fill();
}

function strokeLine(context, from, to) {
  if (!from || !to) {
    return;
  }
  context.beginPath();
  context.moveTo(from.u, from.v);
  context.lineTo(to.u, to.v);
  context.stroke();
}

function drawActor(context, actor, width, height, steer) {
  const rear = Math.max(actor.f0, 0.55);
  const left = actor.r0;
  const right = actor.r1;
  const top = actor.z1;
  const project = (forward, side, z) => projectPoint(forward, side, z, width, height, steer);
  const back = [project(rear, left, 0), project(rear, right, 0), project(rear, right, top), project(rear, left, top)];
  if (back.some((point) => !point)) {
    return;
  }

  context.fillStyle = actor.kind === "wall" ? "#1c1f26" : actor.color;
  fillPoly(context, back);

  if (actor.kind === "wall") {
    return;
  }

  const roof = top * 0.72;
  context.fillStyle = "#141820";
  fillPoly(context, [
    project(rear + actor.length * 0.18, left * 0.72, roof * 0.55),
    project(rear + actor.length * 0.18, right * 0.72, roof * 0.55),
    project(rear + actor.length * 0.62, right * 0.62, top),
    project(rear + actor.length * 0.62, left * 0.62, top),
  ]);

  context.fillStyle = "#ff5a6a";
  const lamp = top * 0.38;
  fillPoly(context, [
    project(rear, left * 0.72, lamp),
    project(rear, left * 0.48, lamp),
    project(rear, left * 0.48, lamp + 0.12),
    project(rear, left * 0.72, lamp + 0.12),
  ]);
  fillPoly(context, [
    project(rear, right * 0.48, lamp),
    project(rear, right * 0.72, lamp),
    project(rear, right * 0.72, lamp + 0.12),
    project(rear, right * 0.48, lamp + 0.12),
  ]);
}
