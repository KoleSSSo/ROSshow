import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";
import { fitSpan, setFitText } from "./pathfit.js";

/** diagnostic_msgs/DiagnosticArray: уровень OK, WARN или ERROR по узлам. */
export class DiagnosticsWidget extends UIComponent {
  #cells = [];
  #key = "";

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ диагностика", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "diagnostics" });
  }

  createBody() {
    const table = document.createElement("table");
    table.className = "sensors sensors--diag";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Узел", "Уровень", "Сообщение"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      if (label === "Уровень") {
        cell.className = "sensors__value";
      }
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (let index = 0; index < 4; index += 1) {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.className = "sensors__topic";
      const nameText = fitSpan("");
      name.append(nameText);
      const level = document.createElement("td");
      level.className = "sensors__value";
      const message = document.createElement("td");
      row.append(name, level, message);
      body.append(row);
      this.#cells.push({ row, name: nameText, level, message });
    }
    table.append(head, body);
    return table;
  }

  sync(frame) {
    const { sample, recording } = frame;
    this.setSubtitle("/diagnostics · diagnostic_msgs/DiagnosticArray");
    const items = [
      ["/rover_01/lidar", sample.front < 10 ? "WARN" : "OK", sample.front < 10 ? "машина впереди близко" : "ведущая цель в норме"],
      ["/rover_01/battery", sample.battery < 20 ? "WARN" : "OK", `${formatNumber(sample.battery)} %`],
      ["/rover_01/temperature", sample.temp >= 40 ? "WARN" : "OK", `${formatNumber(sample.temp)} °C`],
      ["/rover_01/motors", sample.current > 4 ? "WARN" : "OK", `${formatNumber(sample.current)} А`],
    ];
    const key = `${recording.id}:${items.map((item) => item[1] + item[2]).join("|")}`;
    if (key === this.#key) {
      return;
    }
    this.#key = key;
    items.forEach(([name, level, message], index) => {
      const cell = this.#cells[index];
      setFitText(cell.name, name);
      cell.level.textContent = level;
      cell.message.textContent = message;
      cell.row.classList.toggle("is-warn", level === "WARN");
      cell.row.classList.toggle("is-error", level === "ERROR");
    });
  }
}
