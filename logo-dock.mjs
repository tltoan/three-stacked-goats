// The exported Remotion mark: includes the sun above the centered goat bodies.
const MARK_WIDTH = 267.240234375;
const MARK_HEIGHT = 536.939453125;
const BODY_HEIGHT = 459.8515625;
const SUN_OFFSET = 77.087890625;
const INTRO_SCALE = 1.15;

export const DOCK_DURATION = 1800;
export const TAKEOFF_OFFSET = 0.13;

export function sourceLogoBox(videoBox, mediaWidth = 1920, mediaHeight = 1080) {
  const fit = Math.min(videoBox.width / mediaWidth, videoBox.height / mediaHeight);
  const scale = INTRO_SCALE * fit;
  return {
    left: videoBox.left + videoBox.width / 2 - MARK_WIDTH * scale / 2,
    top: videoBox.top + videoBox.height / 2 - (BODY_HEIGHT / 2 + SUN_OFFSET) * scale,
    width: MARK_WIDTH * scale,
    height: MARK_HEIGHT * scale,
  };
}

export function fittedLogoBox(imageBox) {
  const scale = Math.min(imageBox.width / MARK_WIDTH, imageBox.height / MARK_HEIGHT);
  const width = MARK_WIDTH * scale;
  const height = MARK_HEIGHT * scale;
  return {
    left: imageBox.left + (imageBox.width - width) / 2,
    top: imageBox.top + (imageBox.height - height) / 2,
    width,
    height,
  };
}

const smooth = p => p * p * (3 - 2 * p);
const pose = (x, y, sx, sy, angle = 0) =>
  `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy}) rotate(${angle}deg)`;

export function dockKeyframes(start, target, { sun = false } = {}) {
  // Anchor every scale and squash at the hooves, not at the logo's center.
  const dx = target.left + target.width / 2 - start.left - start.width / 2;
  const dy = target.top + target.height - start.top - start.height;
  const ratio = target.width / start.width;
  const arcHeight = Math.max(40, -dy / 4 + 40);
  const frames = [
    { transform: pose(0, 0, 1, 1), offset: 0, easing: 'cubic-bezier(.35,0,.65,1)' },
    { transform: sun ? pose(0, -3, 1, 1) : pose(0, 0, 1.1, .82, -2), offset: .075, easing: 'ease-in' },
  ];
  for (let step = 0; step <= 60; step++) {
    const p = step / 60;
    const progress = smooth(p);
    const scale = Math.exp(Math.log(ratio) * progress);
    const stretch = sun ? 1 : 1 + .08 * Math.exp(-8 * p) * (1 - p);
    const x = dx * progress;
    const y = -12 + (dy + 12) * p - arcHeight * 4 * p * (1 - p);
    const angle = sun ? 0 : -2 * (1 - p) - 7 * Math.sin(Math.PI * p);
    frames.push({ transform: pose(x, y, scale / stretch, scale * stretch, angle), offset: TAKEOFF_OFFSET + .68 * p, easing: 'linear' });
  }
  frames.push(
    { transform: sun ? pose(dx, dy, ratio, ratio) : pose(dx, dy, ratio * 1.14, ratio * .82), offset: .835, easing: 'ease-out' },
    { transform: sun ? pose(dx, dy - 2, ratio, ratio) : pose(dx, dy - 5, ratio * .96, ratio * 1.06, -1), offset: .9, easing: 'ease-in-out' },
    { transform: sun ? pose(dx, dy, ratio, ratio) : pose(dx, dy, ratio * 1.015, ratio * .985), offset: .96, easing: 'ease-out' },
    { transform: pose(dx, dy, ratio, ratio), offset: 1 },
  );
  return frames;
}
