/**
 * Одна сцена беспилотника на кадр: те же машины видят и лидар, и камера.
 * Ось вперёд — forward, вправо — right, вверх — z. Метры, система машины.
 */

const LIDAR_Z = 1.4;

export function observe(t, scene) {
  const street = scene === "street";
  const leadForward = street ? 13.5 + Math.sin(t / 3.1) * 3.2 : 22 + Math.sin(t / 3.8) * 4.5;
  const leadRight = Math.sin(t / 2.2) * (street ? 0.45 : 0.9);
  const heading = Math.sin(t / 5.5) * (street ? 5 : 8);
  const yaw = (-heading * Math.PI) / 180;

  const actors = [
    vehicle("car-lead", "car", leadRight, leadForward, "#d24b4b", 4.5, 1.9, 1.55),
    vehicle("car-left", "car", street ? -3.15 : -6.4, 10.5, "#314056", 4.3, 1.8, 1.5),
    vehicle("car-right", "car", street ? 3.35 : 6.8, street ? 18 : 14 + (t % 9) * 0.35, "#e2b340", 4.7, 1.9, 1.75),
    vehicle("wall-left", "wall", street ? -5.1 : -12, 28, "#23262c", 80, 0.45, 9),
    vehicle("wall-right", "wall", street ? 5.3 : 12.5, 26, "#23262c", 80, 0.45, 9),
  ];

  if (!street) {
    actors.push(vehicle("car-cross", "car", 14 - (t % 16) * 0.85, 26, "#9b6dff", 4.4, 1.85, 1.55));
  }

  const rotated = actors.map((actor) => rotateActor(actor, yaw));
  return {
    actors: rotated,
    heading,
    front: rangeAhead(rotated),
    left: rangeSide(rotated, -1),
    right: rangeSide(rotated, 1),
  };
}

export function castRay(azimuth, elevation, actors) {
  const cosElev = Math.cos(elevation);
  const dirF = Math.cos(azimuth) * cosElev;
  const dirR = Math.sin(azimuth) * cosElev;
  const dirZ = Math.sin(elevation);
  const origin = [0, 0, LIDAR_Z];
  const dir = [dirF, dirR, dirZ];
  let best = null;

  if (dirZ < -0.015) {
    const t = (0 - LIDAR_Z) / dirZ;
    if (t > 0.4 && t < 80) {
      best = hitAt(origin, dir, t);
    }
  }

  for (const actor of actors) {
    const t = hitAabb(origin, dir, actor);
    if (t !== null && (best === null || t < best.slant)) {
      best = hitAt(origin, dir, t);
    }
  }

  return best;
}

function vehicle(id, kind, right, forward, color, length, width, height) {
  return {
    id,
    kind,
    forward,
    right,
    length,
    width,
    height,
    color,
    f0: forward - length / 2,
    f1: forward + length / 2,
    r0: right - width / 2,
    r1: right + width / 2,
    z0: 0,
    z1: height,
  };
}

function rotateActor(actor, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const forward = actor.forward * cos - actor.right * sin;
  const right = actor.forward * sin + actor.right * cos;
  return vehicle(actor.id, actor.kind, right, forward, actor.color, actor.length, actor.width, actor.height);
}

function rangeAhead(actors) {
  let best = 40;
  for (const actor of actors) {
    if (actor.kind !== "car" || actor.f1 < 1 || actor.r0 > 1.3 || actor.r1 < -1.3) {
      continue;
    }
    best = Math.min(best, Math.max(0.4, actor.f0));
  }
  return best;
}

function rangeSide(actors, sign) {
  let best = 20;
  for (const actor of actors) {
    const near = sign < 0 ? -actor.r1 : actor.r0;
    if (near < 0.2 || actor.f1 < 0 || actor.f0 > 25) {
      continue;
    }
    best = Math.min(best, near);
  }
  return best;
}

function hitAabb(origin, dir, box) {
  let tMin = 0.35;
  let tMax = 80;
  const slabs = [
    [origin[0], dir[0], box.f0, box.f1],
    [origin[1], dir[1], box.r0, box.r1],
    [origin[2], dir[2], box.z0, box.z1],
  ];

  for (const [start, delta, min, max] of slabs) {
    if (Math.abs(delta) < 1e-6) {
      if (start < min || start > max) {
        return null;
      }
      continue;
    }
    let enter = (min - start) / delta;
    let exit = (max - start) / delta;
    if (enter > exit) {
      const swap = enter;
      enter = exit;
      exit = swap;
    }
    tMin = Math.max(tMin, enter);
    tMax = Math.min(tMax, exit);
    if (tMin > tMax) {
      return null;
    }
  }

  return tMin;
}

function hitAt(origin, dir, slant) {
  const forward = origin[0] + dir[0] * slant;
  const right = origin[1] + dir[1] * slant;
  const z = origin[2] + dir[2] * slant;
  return {
    slant,
    forward,
    right,
    z,
    range: Math.hypot(forward, right),
  };
}
