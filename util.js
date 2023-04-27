import Color from "https://colorjs.io/dist/color.js";

export { Color };

const supportsP3 =
  window.CSS && CSS.supports("color", "color(display-p3 0 1 0)");
const outputSpaceId = supportsP3 ? "p3" : "srgb";

// This is to handle older browsers and also edge case on
// Safari 16.1 which seems to support display-p3 but not full
// CSS color spec
export function colorToStyle(color, spaceId = outputSpaceId) {
  // re-parse string if not rgb/hsl
  if (typeof color === "string") {
    return colorToStyle(new Color(color));
  }

  // edge case
  if (!color || !color.spaceId) return String(color);

  // operate on a copy
  color = color.clone();

  // convert to output space
  if (!color.spaceId !== spaceId) color = color.to(spaceId);

  // clamp to space's color gamut
  color.toGamut({ space: spaceId });

  return color.toString();
}

export function loadImage(opt = {}) {
  return new Promise((resolve, reject) => {
    var finished = false;
    var image = new window.Image();
    image.onload = () => {
      if (finished) return;
      finished = true;
      resolve(image);
    };
    image.onerror = () => {
      if (finished) return;
      finished = true;
      reject(new Error("Error while loading image at " + opt.url));
    };
    if (opt.crossOrigin) image.crossOrigin = opt.crossOrigin;
    image.src = opt.url;
  });
}