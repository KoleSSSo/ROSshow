import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";
import { fitSpan } from "./pathfit.js";

/** Таблица показаний на текущем кадре записи. */
export class SensorTableWidget extends UIComponent {
  #body;
  #frame;
  #groups = {
    motion: true,
    power: true,
    range: true,
  };
  #groupKey = "";
  #valueCells = [];

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ датчики", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "sensors" });
  }

  createBody() {
    const table = document.createElement("table");
    table.className = "sensors sensors--paths";

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Датчик", "Топик", "Значение"]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      if (label === "Значение") {
        cell.className = "sensors__value";
      }
      headRow.append(cell);
    }
    head.append(headRow);

    const body = document.createElement("tbody");
    table.append(head, body);
    this.#body = body;
    return table;
  }

  createSettings() {
    const box = document.createElement("div");
    box.className = "settings";
    const options = [
      ["motion", "Движение и курс"],
      ["power", "Питание и температура"],
      ["range", "Дистанции"],
    ];
    for (const [key, label] of options) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = this.#groups[key];
      this.listen(input, "change", () => {
        this.#groups[key] = input.checked;
        if (this.#frame) {
          this.sync(this.#frame);
        }
      });
      box.append(settingRow(input, label));
    }
    return box;
  }

  sync(frame) {
    this.#frame = frame;
    if (!this.#body) {
      return;
    }

    const { recording, sample } = frame;
    this.setSubtitle(`${recording.id} · ${recording.robot}`);

    const rows = [
      ["motion", "Скорость", "/rover_01/odom", `${formatNumber(sample.v)} м/с`, false],
      ["power", "Заряд", "/rover_01/battery", `${formatNumber(sample.battery)} %`, sample.battery < 20],
      ["power", "Температура", "/rover_01/temperature", `${formatNumber(sample.temp)} °C`, sample.temp >= 40],
      ["range", "Дистанция вперёд", "/rover_01/range/front", `${formatNumber(sample.front)} м`, sample.front < 10],
      ["range", "Слева", "/rover_01/range/left", `${formatNumber(sample.left)} м`, sample.left < 1.6],
      ["range", "Справа", "/rover_01/range/right", `${formatNumber(sample.right)} м`, sample.right < 1.6],
      ["motion", "Курс", "/rover_01/imu", `${formatNumber(sample.heading)}°`, false],
      ["power", "Ток мотора", "/rover_01/motor/current", `${formatNumber(sample.current)} А`, false],
    ];
    const visible = rows.filter((row) => this.#groups[row[0]]);
    const groupKey = visible.map((row) => row[1]).join("|");
    if (groupKey !== this.#groupKey) {
      this.#groupKey = groupKey;
      this.#valueCells = [];
      this.#body.replaceChildren();
      for (const [, name, topic] of visible) {
        const row = document.createElement("tr");
        const nameCell = document.createElement("td");
        nameCell.textContent = name;
        const topicCell = document.createElement("td");
        topicCell.className = "sensors__topic";
        topicCell.append(fitSpan(topic));
        const valueCell = document.createElement("td");
        valueCell.className = "sensors__value";
        row.append(nameCell, topicCell, valueCell);
        this.#body.append(row);
        this.#valueCells.push({ row, valueCell });
      }
    }

    visible.forEach(([, , , value, warn], index) => {
      const cell = this.#valueCells[index];
      if (!cell) {
        return;
      }
      if (cell.valueCell.textContent !== value) {
        cell.valueCell.textContent = value;
      }
      cell.row.classList.toggle("is-warn", warn);
    });
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
