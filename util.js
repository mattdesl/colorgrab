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

export function attachImageDrop({ container = window, onDrop }) {
  function handlerFunction(ev) {
    ev.preventDefault();
    if (ev.type === "drop") {
      let dt = ev.dataTransfer;
      let files = dt.files;
      if (!files.length) return;
      const file = files[0];
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const img = document.createElement("img");
        img.crossOrigin = "anonymous";
        img.onload = () => {
          onDrop(null, img);
        };
        img.onerror = () =>
          onDrop(new Error(`Could not load image: ${file.name}`));
        img.src = reader.result;
      };
      reader.onerror = () =>
        onDrop(new Error(`Could not read file: ${file.name}`));
    }
  }

  container.addEventListener("dragenter", handlerFunction, false);
  container.addEventListener("dragleave", handlerFunction, false);
  container.addEventListener("dragover", handlerFunction, false);
  container.addEventListener("drop", handlerFunction, false);
  return () => {
    container.removeEventListener("dragenter", handlerFunction, false);
    container.removeEventListener("dragleave", handlerFunction, false);
    container.removeEventListener("dragover", handlerFunction, false);
    container.removeEventListener("drop", handlerFunction, false);
  };
}
