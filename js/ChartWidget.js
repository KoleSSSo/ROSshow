import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";

const NS = "http://www.w3.org/2000/svg";
const PLOT = "#9b6dff";

/** Один график скорости. Линия одного цвета, без хитмапа. */
export class ChartWidget extends UIComponent {
  #svg;
  #value;
  #frame;
  #fill = true;
  #lineKey = "";
  #geom = null;
  #fillPath;
  #strokePath;
  #cursor;
  #dot;

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ скорость", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "chart" });
  }

  createBody() {
    const wrap = document.createElement("div");
    wrap.className = "chart";

    const readout = document.createElement("p");
    readout.className = "chart__value";
    const value = document.createElement("span");
    const unit = document.createElement("span");
    unit.className = "chart__unit";
    unit.textContent = "м/с";
    readout.append(value, unit);

    const svg = document.createElementNS(NS, "svg");
    svg.classList.add("chart__svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "График скорости по времени записи");

    wrap.append(readout, svg);
    this.#svg = svg;
    this.#value = value;
    return wrap;
  }

  createSettings() {
    const box = document.createElement("div");
    box.className = "settings";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.#fill;
    this.listen(input, "change", () => {
      this.#fill = input.checked;
      if (this.#frame) {
        this.#draw(this.#frame.recording.samples, this.#frame.index);
      }
    });
    box.append(settingRow(input, "Заливка под линией"));
    return box;
  }

  sync(frame) {
    this.#frame = frame;
    if (!this.#svg) {
      return;
    }

    const { recording, sample } = frame;
    this.setSubtitle(`/rover_01/odom · ${recording.robot}`);
    this.#value.textContent = formatNumber(sample.v);
    this.#draw(recording.samples, frame.index);
  }

  #draw(samples, index) {
    const width = 640;
    const height = 200;
    const padX = 8;
    const padY = 16;
    const lineKey = `${this.#frame?.recording?.id ?? ""}:${samples.length}:${this.#fill}`;
    if (!this.#strokePath) {
      this.#fillPath = document.createElementNS(NS, "path");
      this.#fillPath.setAttribute("fill", PLOT);
      this.#fillPath.setAttribute("opacity", "0.16");
      this.#strokePath = document.createElementNS(NS, "path");
      this.#strokePath.setAttribute("fill", "none");
      this.#strokePath.setAttribute("stroke", PLOT);
      this.#strokePath.setAttribute("stroke-width", "2.4");
      this.#strokePath.setAttribute("stroke-linejoin", "round");
      this.#strokePath.setAttribute("stroke-linecap", "round");
      this.#cursor = document.createElementNS(NS, "line");
      this.#cursor.setAttribute("stroke", "rgba(242, 243, 245, 0.28)");
      this.#cursor.setAttribute("stroke-width", "1");
      this.#dot = document.createElementNS(NS, "circle");
      this.#dot.setAttribute("r", "4.5");
      this.#dot.setAttribute("fill", PLOT);
      this.#svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      this.#svg.replaceChildren(this.#strokePath, this.#cursor, this.#dot);
    }

    if (!this.#geom || lineKey !== this.#lineKey) {
      const nextSpeeds = samples.map((item) => item.v);
      const peak = Math.max(...nextSpeeds, 0.001);
      const nextX = (point) => padX + (point / Math.max(samples.length - 1, 1)) * (width - padX * 2);
      const nextY = (speed) => height - padY - (speed / peak) * (height - padY * 2);
      this.#geom = { speeds: nextSpeeds, xAt: nextX, yAt: nextY };
      this.#lineKey = lineKey;
      const line = nextSpeeds
        .map((speed, point) => `${point === 0 ? "M" : "L"} ${nextX(point)} ${nextY(speed)}`)
        .join(" ");
      this.#strokePath.setAttribute("d", line);
      this.#fillPath.setAttribute(
        "d",
        `${line} L ${nextX(nextSpeeds.length - 1)} ${height - padY} L ${nextX(0)} ${height - padY} Z`,
      );
      if (this.#fill) {
        this.#svg.replaceChildren(this.#fillPath, this.#strokePath, this.#cursor, this.#dot);
      } else {
        this.#svg.replaceChildren(this.#strokePath, this.#cursor, this.#dot);
      }
    }

    const placeX = this.#geom.xAt;
    const placeY = this.#geom.yAt;
    const x = String(placeX(index));
    this.#cursor.setAttribute("x1", x);
    this.#cursor.setAttribute("x2", x);
    this.#cursor.setAttribute("y1", String(padY));
    this.#cursor.setAttribute("y2", String(height - padY));
    this.#dot.setAttribute("cx", x);
    this.#dot.setAttribute("cy", String(placeY(this.#geom.speeds[index])));
    this.#svg.setAttribute("aria-label", `Скорость ${formatNumber(this.#geom.speeds[index])} метров в секунду`);
  }
}

function settingRow(control, label) {
  const row = document.createElement("label");
  row.className = "settings__row";
  const text = document.createElement("span");
  text.textContent = label;
  row.append(control, text);
  return row;
}
