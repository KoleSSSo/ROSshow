import { UIComponent } from "./UIComponent.js";
import { formatNumber } from "./format.js";

/** Лента /rosout. У сообщения есть уровень, как у rcl_interfaces/Log. */
export class ConsoleWidget extends UIComponent {
  #list;
  #recordingId = "";
  #shown = 0;

  constructor({ id, onClose, onMove, onNudge, onResize, onRelayout } = {}) {
    super({ title: "/ консоль", id, onClose, onMove, onNudge, onResize, onRelayout, kind: "console" });
  }

  createBody() {
    const list = document.createElement("ol");
    list.className = "console";
    this.#list = list;
    return list;
  }

  sync(frame) {
    const { recording, sample } = frame;
    this.setSubtitle("/rosout · rcl_interfaces/Log");
    const visible = recording.logs.filter((entry) => entry.t <= sample.t + 0.001);

    if (this.#recordingId !== recording.id || visible.length < this.#shown) {
      this.#list.replaceChildren();
      this.#shown = 0;
      this.#recordingId = recording.id;
    }

    for (let index = this.#shown; index < visible.length; index += 1) {
      this.#list.append(logLine(visible[index]));
    }
    if (visible.length !== this.#shown) {
      this.#shown = visible.length;
      this.#list.scrollTop = this.#list.scrollHeight;
    }
  }
}

function logLine(entry) {
  const item = document.createElement("li");
  item.className = `console__line console__line--${entry.level.toLowerCase()}`;

  const head = document.createElement("p");
  head.className = "console__head";

  const time = document.createElement("span");
  time.className = "console__time";
  time.textContent = formatNumber(entry.t);

  const level = document.createElement("span");
  level.className = "console__level";
  level.textContent = entry.level;

  const name = document.createElement("span");
  name.className = "console__name";
  name.textContent = entry.name;

  const code = document.createElement("pre");
  code.className = "console__code";
  code.textContent = entry.code;

  head.append(time, level, name);
  item.append(head, code);
  return item;
}
