import { Dashboard } from "./js/Dashboard.js";
import { RecordingPlayer } from "./js/RecordingPlayer.js";
import { recordings } from "./js/data/recordings.js";
import { ChartWidget } from "./js/ChartWidget.js";
import { SensorTableWidget } from "./js/SensorTableWidget.js";
import { CameraWidget } from "./js/CameraWidget.js";
import { LidarWidget } from "./js/LidarWidget.js";
import { VariablesWidget } from "./js/VariablesWidget.js";
import { BatteryWidget } from "./js/BatteryWidget.js";
import { ConsoleWidget } from "./js/ConsoleWidget.js";
import { DiagnosticsWidget } from "./js/DiagnosticsWidget.js";
import { icon } from "./js/icons.js";

const host = document.querySelector("#dashboard");
const transport = document.querySelector("#transport");

if (!host || !transport) {
  throw new Error("На странице нет панели или блока управления записью");
}

const dashboard = new Dashboard(host, {
  chart: ChartWidget,
  sensors: SensorTableWidget,
  camera: CameraWidget,
  lidar: LidarWidget,
  variables: VariablesWidget,
  battery: BatteryWidget,
  console: ConsoleWidget,
  diagnostics: DiagnosticsWidget,
});

const player = new RecordingPlayer(transport, recordings, (frame) => {
  dashboard.sync(frame);
});

const themeButton = document.querySelector("#theme-toggle");
const savedTheme = localStorage.getItem("rospectra-theme");
if (savedTheme === "light" || savedTheme === "dark") {
  document.documentElement.dataset.theme = savedTheme;
}

function paintTheme() {
  const light = document.documentElement.dataset.theme === "light";
  themeButton.setAttribute("aria-pressed", String(light));
  themeButton.setAttribute("aria-label", light ? "Включить тёмную тему" : "Включить светлую тему");
  themeButton.replaceChildren(icon(light ? "moon" : "sun"));
}

paintTheme();
themeButton.addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("rospectra-theme", document.documentElement.dataset.theme);
  paintTheme();
});

const addToggle = document.querySelector("#add-toggle");
const addList = document.querySelector("#add-list");
addToggle.replaceChildren(icon("plus"));

function closeAddMenu() {
  addList.hidden = true;
  addToggle.setAttribute("aria-expanded", "false");
}

function openAddMenu() {
  addList.hidden = false;
  addToggle.setAttribute("aria-expanded", "true");
  addList.querySelector("button")?.focus();
}

addToggle.addEventListener("click", () => {
  if (addList.hidden) {
    openAddMenu();
    return;
  }
  closeAddMenu();
});

addList.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    dashboard.addWidget(button.dataset.add);
    closeAddMenu();
    addToggle.focus();
  });
});

document.addEventListener("click", (event) => {
  if (addList.hidden) {
    return;
  }
  if (!addToggle.contains(event.target) && !addList.contains(event.target)) {
    closeAddMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !addList.hidden) {
    closeAddMenu();
    addToggle.focus();
  }
});

dashboard.addWidget("lidar");
dashboard.addWidget("camera");
dashboard.addWidget("diagnostics");
dashboard.addWidget("variables");
dashboard.addWidget("battery");
dashboard.addWidget("console");
dashboard.addWidget("chart");

dashboard.sync(player.frame);
