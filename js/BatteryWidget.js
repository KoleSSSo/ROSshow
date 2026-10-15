import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";

const CAPACITY = 18;

/** sensor_msgs/BatteryState: заряд, напряжение, ток и статус питания. */
export class BatteryWidget extends UIComponent {
  #percent;
  #fill;
  #rows = [];

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ аккумулятор", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "battery" });
  }

  createBody() {
    const wrap = document.createElement("div");
    wrap.className = "battery";

    const percent = document.createElement("p");
    percent.className = "chart__value";
    const fill = document.createElement("span");
    fill.className = "battery__bar";
    const level = document.createElement("span");
    fill.append(level);
    this.#percent = percent;
    this.#fill = level;

    const table = document.createElement("table");
    table.className = "sensors sensors--pair";
    const body = document.createElement("tbody");
    for (const label of ["Напряжение", "Ток", "Заряд", "Статус", "Здоровье"]) {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = label;
      const value = document.createElement("td");
      value.className = "sensors__value";
      row.append(name, value);
      body.append(row);
      this.#rows.push({ row, value });
    }
    table.append(body);
    wrap.append(percent, fill, table);
    return wrap;
  }

  sync(frame) {
    const { sample } = frame;
    this.setSubtitle("/rover_01/battery · sensor_msgs/BatteryState");
    const text = `${formatNumber(sample.battery)} %`;
    if (this.#percent.textContent !== text) {
      this.#percent.textContent = text;
    }
    this.#fill.style.width = `${Math.max(0, Math.min(100, sample.battery))}%`;
    this.#percent.classList.toggle("is-low", sample.battery < 20);

    const status = sample.v > 0.05 ? "DISCHARGING" : "NOT_CHARGING";
    const health = sample.temp >= 40 ? "OVERHEAT" : "GOOD";
    const values = [
      `${formatNumber(sample.voltage)} В`,
      `${formatNumber(sample.current)} А`,
      `${formatNumber((sample.battery / 100) * CAPACITY)} / ${CAPACITY} А·ч`,
      status,
      health,
    ];
    values.forEach((value, index) => {
      const cell = this.#rows[index];
      if (cell.value.textContent !== value) {
        cell.value.textContent = value;
      }
      const warn = (index === 4 && health !== "GOOD") || (index === 3 && sample.battery < 20);
      cell.row.classList.toggle("is-warn", warn);
    });
  }
}
