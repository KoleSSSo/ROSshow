import { icon } from "./icons.js";
import { formatSeconds } from "./format.js";

/**
 * Общая панель записи: выбор фрагмента, пуск, шаг назад и вперёд.
 * Все окна получают один и тот же кадр.
 */
export class RecordingPlayer {
  #recordings;
  #recording;
  #index = 0;
  #playing = false;
  #timer = null;
  #onChange;
  #playButton;
  #range;
  #now;
  #end;

  constructor(host, recordings, onChange) {
    this.#recordings = recordings;
    this.#recording = recordings[0];
    this.#onChange = onChange;
    host.append(this.#build(recordings));
    this.#emit();
  }

  get frame() {
    return this.#snapshot();
  }

  #build(recordings) {
    const bar = document.createElement("div");
    bar.className = "transport";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Управление записью");

    const recordLabel = document.createElement("label");
    recordLabel.className = "transport__record";
    const recordCaption = document.createElement("span");
    recordCaption.textContent = "Запись";
    const select = document.createElement("select");
    select.className = "transport__select";
    select.setAttribute("aria-label", "Выбор записи");

    for (const recording of recordings) {
      const option = document.createElement("option");
      option.value = recording.id;
      option.textContent = recording.title;
      select.append(option);
    }

    select.addEventListener("change", () => {
      this.#recording = this.#recordings.find((item) => item.id === select.value) ?? this.#recordings[0];
      this.#index = 0;
      this.#pause();
      this.#emit();
    });
    recordLabel.append(recordCaption, select);

    const back = this.#iconButton("back", "На кадр назад", () => this.#step(-1));
    const play = this.#iconButton("play", "Пуск", () => this.#toggle());
    play.classList.add("transport__play");
    const forward = this.#iconButton("forward", "На кадр вперёд", () => this.#step(1));

    const range = document.createElement("input");
    range.type = "range";
    range.className = "transport__seek";
    range.min = "0";
    range.step = "1";
    range.setAttribute("aria-label", "Позиция в записи");
    range.addEventListener("input", () => {
      this.#pause();
      this.#index = Number(range.value);
      this.#emit();
    });

    const clock = document.createElement("p");
    clock.className = "transport__clock";
    const now = document.createElement("span");
    now.className = "transport__now";
    const end = document.createElement("span");
    end.className = "transport__end";
    clock.append(now, end);

    bar.append(recordLabel, back, play, forward, range, clock);
    this.#playButton = play;
    this.#range = range;
    this.#now = now;
    this.#end = end;
    return bar;
  }

  #iconButton(name, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "transport__button";
    button.setAttribute("aria-label", label);
    button.append(icon(name));
    button.addEventListener("click", onClick);
    return button;
  }

  #toggle() {
    if (this.#playing) {
      this.#pause();
      return;
    }

    if (this.#index >= this.#recording.samples.length - 1) {
      this.#index = 0;
    }

    this.#playing = true;
    this.#paintPlay();
    this.#timer = setInterval(() => {
      if (this.#index >= this.#recording.samples.length - 1) {
        this.#pause();
        return;
      }
      this.#index += 1;
      this.#emit();
    }, 60);
  }

  #pause() {
    this.#playing = false;
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#paintPlay();
  }

  #step(delta) {
    this.#pause();
    const last = this.#recording.samples.length - 1;
    this.#index = Math.min(last, Math.max(0, this.#index + delta));
    this.#emit();
  }

  #emit() {
    this.#paintControls();
    this.#onChange(this.#snapshot());
  }

  #snapshot() {
    return {
      recording: this.#recording,
      index: this.#index,
      sample: this.#recording.samples[this.#index],
    };
  }

  #paintPlay() {
    if (!this.#playButton) {
      return;
    }
    this.#playButton.replaceChildren(icon(this.#playing ? "pause" : "play"));
    this.#playButton.setAttribute("aria-label", this.#playing ? "Пауза" : "Пуск");
    this.#playButton.setAttribute("aria-pressed", String(this.#playing));
  }

  #paintControls() {
    const last = this.#recording.samples.length - 1;
    const sample = this.#recording.samples[this.#index];
    const end = this.#recording.samples[last];
    this.#range.max = String(last);
    this.#range.value = String(this.#index);
    const now = formatSeconds(sample.t);
    const total = ` / ${formatSeconds(end.t)} с`;
    if (this.#now.textContent !== now) {
      this.#now.textContent = now;
    }
    if (this.#end.textContent !== total) {
      this.#end.textContent = total;
    }
  }
}
