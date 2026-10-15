import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";
import { fitSpan } from "./pathfit.js";

/** Набор топиков, как панель Raw Messages: тип сообщения и текущее поле. */
export class VariablesWidget extends UIComponent {
  #cells = [];

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ переменные", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "variables" });
  }

  createBody() {
    const table = document.createElement("table");
    table.className = "sensors sensors--paths";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Топик", "Тип", "Значение"]) {
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
    const rows = [
      ["/rover_01/odom", "nav_msgs/Odometry"],
      ["/rover_01/cmd_vel", "geometry_msgs/Twist"],
      ["/rover_01/imu", "sensor_msgs/Imu"],
      ["/rover_01/battery", "sensor_msgs/BatteryState"],
      ["/rover_01/range/front", "sensor_msgs/Range"],
    ];
    for (const [topic, type] of rows) {
      const row = document.createElement("tr");
      const topicCell = document.createElement("td");
      topicCell.className = "sensors__topic";
      topicCell.append(fitSpan(topic));
      const typeCell = document.createElement("td");
      typeCell.append(fitSpan(type));
      const valueCell = document.createElement("td");
      valueCell.className = "sensors__value";
      row.append(topicCell, typeCell, valueCell);
      body.append(row);
      this.#cells.push(valueCell);
    }

    table.append(head, body);
    return table;
  }

  sync(frame) {
    const { sample, recording } = frame;
    this.setSubtitle(`${recording.id} · rover-01`);
    const values = [
      `${formatNumber(sample.v)} м/с`,
      `${formatNumber(sample.v)} м/с`,
      `${formatNumber(sample.heading)}°`,
      `${formatNumber(sample.battery)} %`,
      `${formatNumber(sample.front)} м`,
    ];
    values.forEach((value, index) => {
      const cell = this.#cells[index];
      if (cell && cell.textContent !== value) {
        cell.textContent = value;
      }
    });
  }
}
