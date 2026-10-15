import { observe } from "./scene.js";

/**
 * Две выдуманные записи. Это не rosbag и не сеть:
 * общий таймлайн, от которого питаются все окна.
 * Опорные скорости те же, между ними кадр каждые 0,1 с.
 */
const STEP = 0.1;
const KEY = 2.5;

const corridorSpeed = [
  0, 0.18, 0.42, 0.71, 0.96, 1.14, 1.28, 1.35, 1.31, 1.05, 0.62, 0.38, 0.58, 0.91,
  1.16, 1.27, 1.22, 0.98, 0.64, 0.31, 0.08, 0, 0, 0,
];

const yardSpeed = [
  0, 0.22, 0.48, 0.7, 0.74, 0.68, 0.4, 0.25, 0.55, 0.86, 1.02, 0.95, 0.6, 0.28, 0.1, 0,
];

export const recordings = [
  buildRecording({
    id: "demo-run-01",
    title: "demo-run-01 · улица",
    scene: "street",
    recordedAt: "2026-02-06T14:32:10+03:00",
    speeds: corridorSpeed,
    batteryStart: 86,
    tempStart: 34.2,
  }),
  buildRecording({
    id: "demo-run-02",
    title: "demo-run-02 · проспект",
    scene: "avenue",
    recordedAt: "2026-02-08T11:05:40+03:00",
    speeds: yardSpeed,
    batteryStart: 91,
    tempStart: 29.4,
  }),
];

function buildRecording({ id, title, scene, recordedAt, speeds, batteryStart, tempStart }) {
  const duration = (speeds.length - 1) * KEY;
  const count = Math.round(duration / STEP) + 1;
  const samples = [];

  for (let step = 0; step < count; step += 1) {
    const t = Math.min(duration, step * STEP);
    const index = t / KEY;
    const speed = speedAt(speeds, index);
    const battery = Math.max(0, batteryStart - index * 0.28);
    const temp = tempStart + index * (scene === "street" ? 0.3 : 0.22);
    const view = observe(t, scene);

    samples.push({
      t,
      v: speed,
      battery,
      temp,
      heading: view.heading,
      front: view.front,
      left: view.left,
      right: view.right,
      actors: view.actors,
      current: 0.7 + speed * 2.8,
      voltage: 25.2 - (batteryStart - battery) * 0.03 - speed * 0.15,
    });
  }

  return {
    id,
    title,
    scene,
    robot: "rover-01",
    recordedAt,
    samples,
    logs: buildLogs(samples),
  };
}

function speedAt(speeds, index) {
  const start = Math.max(0, Math.min(speeds.length - 1, Math.floor(index)));
  const end = Math.min(speeds.length - 1, start + 1);
  const mix = index - start;
  return speeds[start] + (speeds[end] - speeds[start]) * mix;
}

function buildLogs(samples) {
  const logs = [
    {
      t: 0,
      level: "DEBUG",
      name: "perception.bootstrap",
      code: [
        "import rclpy",
        "from sensor_msgs.msg import PointCloud2, Image",
        "",
        "node = rclpy.create_node('rosshow_debug')",
        "node.create_subscription(PointCloud2, '/rover_01/velodyne_points', on_cloud, 10)",
        "node.create_subscription(Image, '/rover_01/camera/image_raw', on_image, 10)",
      ].join("\n"),
    },
  ];
  let nextBeat = 4;
  let warned = false;

  for (const sample of samples) {
    if (!warned && sample.front < 10) {
      warned = true;
      logs.push({
        t: sample.t,
        level: "WARN",
        name: "perception.tracker",
        code: [
          "def follow_distance(track):",
          `    gap = ${sample.front.toFixed(2)}  # meters, base_link`,
          "    if gap < 10.0:",
          "        raise CloseVehicle(track.id, gap)",
          "",
          `CloseVehicle: car-lead at forward=${sample.front.toFixed(2)}`,
        ].join("\n"),
      });
    }

    if (sample.t + 0.001 < nextBeat) {
      continue;
    }

    const lead = sample.actors.find((actor) => actor.id === "car-lead");
    logs.push({
      t: sample.t,
      level: "DEBUG",
      name: "perception.fusion",
      code: [
        `t = ${sample.t.toFixed(1)}`,
        "cloud = read_points(msg, field_names=('x', 'y', 'z'))",
        "image = bridge.imgmsg_to_cv2(frame, 'bgr8')",
        "boxes = detector.infer(image)  # same actors as lidar",
        `lead = {'id': 'car-lead', 'x': ${lead.right.toFixed(2)}, 'y': ${lead.forward.toFixed(2)}, 'class': 'car'}`,
        `odom.twist.linear.x = ${sample.v.toFixed(2)}`,
        `battery.percentage = ${sample.battery.toFixed(1)}`,
        "assert abs(lidar_range - camera_range) < 0.05",
      ].join("\n"),
    });
    nextBeat += 6;
  }

  return logs;
}
