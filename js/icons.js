const NS = "http://www.w3.org/2000/svg";

const SHAPES = {
  play: ["M8 6l11 6-11 6V6z"],
  pause: ["M8 6v12", "M16 6v12"],
  back: ["M12.5 7 6.5 12l6 5V7z", "M18.5 7l-6 5 6 5V7z"],
  forward: ["M5.5 7l6 5-6 5V7z", "M11.5 7l6 5-6 5V7z"],
  minus: ["M6 12h12"],
  plus: ["M12 6v12", "M6 12h12"],
  expand: ["M9 5H5v4", "M15 5h4v4", "M19 15v4h-4", "M5 15v4h4"],
  compress: ["M5 9V5h4", "M15 5h4v4", "M19 15v4h-4", "M9 19H5v-4"],
  close: ["M7 7l10 10", "M17 7 7 17"],
  move: [
    "M12 3v18",
    "M3 12h18",
    "M12 3l-2.4 2.4",
    "M12 3l2.4 2.4",
    "M12 21l-2.4-2.4",
    "M12 21l2.4-2.4",
    "M3 12l2.4-2.4",
    "M3 12l2.4 2.4",
    "M21 12l-2.4-2.4",
    "M21 12l-2.4 2.4",
  ],
  zoom: ["M11 11m-5.2 0a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0", "M15.2 15.2 20 20"],
  crosshair: ["M12 4.5v3", "M12 16.5v3", "M4.5 12h3", "M16.5 12h3", "M12 12m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0-5.2 0"],
  cursor: ["M5.2 3.2 5.8 18.2l3.4-3.5 2.7 6.2 2.3-1-2.7-6.1 4.8-.2L5.2 3.2z"],
};

export function icon(name) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  if (name === "dots") {
    for (const cy of [7, 12, 17]) {
      const circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", "12");
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r", "1.35");
      circle.setAttribute("fill", "currentColor");
      svg.append(circle);
    }
    return svg;
  }

  if (name === "sun") {
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "3.2");
    svg.append(circle);
    for (const d of ["M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "M5.6 5.6l1.4 1.4", "M17 17l1.4 1.4", "M18.4 5.6 17 7", "M7 17l-1.4 1.4"]) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  }

  if (name === "tilt") {
    const arc = document.createElementNS(NS, "path");
    arc.setAttribute("d", "M18.6 13.16A6.7 6.7 0 1 1 15.55 6.32");
    const head = document.createElementNS(NS, "path");
    head.setAttribute("d", "M18.69 8.28 14.46 8.06 16.64 4.58Z");
    head.setAttribute("fill", "currentColor");
    head.setAttribute("stroke", "none");
    svg.append(arc, head);
    return svg;
  }

  if (name === "moon") {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M16 13.2A6.2 6.2 0 1 1 10.2 5.2 4.4 4.4 0 0 0 16 13.2z");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("stroke", "none");
    svg.append(path);
    return svg;
  }

  for (const d of SHAPES[name]) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    if (name === "play" || name === "cursor") {
      path.setAttribute("fill", "currentColor");
      path.setAttribute("stroke", "none");
    }
    svg.append(path);
  }

  return svg;
}
