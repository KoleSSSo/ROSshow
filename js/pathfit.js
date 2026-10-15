/** Варианты от полного пути до последнего сегмента: .../Odometry, затем Odometry. */
function pathOptions(text) {
  const parts = text.split("/").filter((part) => part.length > 0);
  if (parts.length < 2) {
    return [text];
  }

  const options = [text];
  for (let index = 1; index < parts.length; index += 1) {
    options.push(`.../${parts.slice(index).join("/")}`);
  }

  const last = parts[parts.length - 1];
  if (options[options.length - 1] !== last) {
    options.push(last);
  }
  return options;
}

export function fitSpan(text) {
  const span = document.createElement("span");
  span.className = "sensors__fit";
  span.dataset.full = text;
  span.textContent = text;
  return span;
}

export function fitPath(element) {
  const full = element.dataset.full ?? "";
  const width = element.clientWidth;
  if (width <= 0) {
    return;
  }

  const options = pathOptions(full);
  let chosen = options[options.length - 1];
  for (const option of options) {
    element.textContent = option;
    if (element.scrollWidth <= width + 1) {
      chosen = option;
      break;
    }
  }

  element.textContent = chosen;
  const clipped = element.scrollWidth > width + 1;
  element.classList.toggle("is-tail", clipped);
  if (chosen === full && !clipped) {
    element.removeAttribute("title");
    element.removeAttribute("aria-label");
  } else {
    element.title = full;
    element.setAttribute("aria-label", full);
  }
}

export function fitPaths(root) {
  root?.querySelectorAll(".sensors__fit").forEach((element) => fitPath(element));
}

export function setFitText(element, text) {
  if (!element) {
    return;
  }
  element.dataset.full = text;
  fitPath(element);
}
