import { Color, colorToStyle, loadImage } from "./util.js";
import canvasSketch from "https://cdn.jsdelivr.net/npm/canvas-sketch@0.7.7/dist/canvas-sketch.m.js";
// import { quantize } from "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js";

const settings = {
  dimensions: [1024, 1024],
  hotkeys: false,
};

function attachImageDrop({ container = window, onDrop }) {
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

function picker(opts = {}) {
  async function sketch(props) {
    const { data = {} } = props;

    let image;

    let srcWidth, srcHeight, dstWidth, dstHeight, pixels;
    let tmpCanvas = document.createElement("canvas");
    let tmpContext = tmpCanvas.getContext("2d", { willReadFrequently: true });
    let aspect = 1;

    const { maxSize = 2048 } = data;
    let maxArr = Array.isArray(maxSize) ? maxSize : [maxSize, maxSize];
    let [maxWidth, maxHeight] = maxArr;

    attachImageDrop({
      container: window,
      onDrop: (err, img) => {
        if (err) return window.alert(err.message);
        redraw(img, true);
      },
    });

    let showLoupe = false;
    const loupe = document.body.appendChild(document.createElement("div"));
    const loupeText = loupe.appendChild(document.createElement("div"));
    const loupeHeight = 24;
    const noSelect = {
      "user-select": "none",
      "-webkit-tap-highlight-color": "rgba(0, 0, 0, 0)",
    };
    const cssStyle = {
      ...noSelect,
      zIndex: "100000",
      position: "absolute",
      boxSizing: "border-box",
      width: `0`,
      display: "flex",
      height: `${loupeHeight}px`,
      top: `${0}px`,
      left: "0",
      "justify-content": "center",
      "align-items": "center",
      font: "12px monospace",
      color: "white",
    };
    Object.assign(loupe.style, {
      ...cssStyle,
    });
    loupe.style.display = "none";
    let curText, curColor;
    let clickTimer;
    let isCopying = false;

    let swatches = document.body.appendChild(document.createElement("div"));
    Object.assign(swatches.style, {
      ...cssStyle,
      height: "16px",
      "flex-direction": "row",
      width: "100%",
      "justify-content": "flex-start",
      "align-items": "center",
      boxSizing: "border-box",
      // top: "0px",
      left: "0px",
      paddingLeft: "15px",
      paddingBottom: "25px",
      top: "initial",
      lineHeight: "16px",
      bottom: "0px",
    });

    const buttonStyle = {
      ...noSelect,
      font: "11px monospace",
      marginRight: "10px",
      appearance: "none",
      cursor: "pointer",
      background: "none",
      border: "1px solid hsl(0,0%,75%)",
      padding: "5px",
      borderRadius: "3px 3px",
    };

    const createDropdown = ({
      prefix = "",
      options,
      onChange,
      parent = document.body,
    }) => {
      const select = parent.appendChild(document.createElement("select"));
      options.forEach((m) => {
        const opt = select.appendChild(document.createElement("option"));
        opt.value = m;
        opt.text = `${prefix}${m}`;
      });
      Object.assign(select.style, {
        ...buttonStyle,
        padding: "5px 19px 5px 5px",
        "background-repeat": "no-repeat",
        "background-position-x": "100%",
        "background-position-y": "-2px",
        "background-image": `url(data:image/svg+xml;base64,PHN2ZyBmaWxsPSdibGFjaycgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyB3aWR0aD0nMjQnIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHBhdGggZD0nTTcgMTBsNSA1IDUtNXonLz48cGF0aCBkPSdNMCAwaDI0djI0SDB6JyBmaWxsPSdub25lJy8+PC9zdmc+)`,
      });
      select.onchange = (ev) => {
        const idx = ev.currentTarget.selectedIndex;
        onChange(options[idx], idx);
      };
      return select;
    };

    let mode = 0;
    const modes = ["hex", "srgb", "lab", "lch", "oklch"];
    createDropdown({
      parent: swatches,
      options: modes,
      prefix: "mode: ",
      onChange: (_, idx) => (mode = idx),
    });

    const createButton = (text, fn) => {
      const jsonButton = swatches.appendChild(document.createElement("button"));
      jsonButton.textContent = text;
      Object.assign(jsonButton.style, { ...buttonStyle, width: "75px" });
      jsonButton.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          fn(ev);
        },
        { passive: false }
      );
      return jsonButton;
    };

    const paletteButton = createButton("◐", async () => {
      const url = window.prompt("Load Image from URL:");
      if (url) {
        try {
          // const resp = await window.fetch(url);
          const img = await loadImage({
            crossOrigin: "anonymous",
            url,
          });
          redraw(img, true);
        } catch (err) {
          window.alert(err.message);
        }
      }
      // if (pixels) {
      //   const palette = quantize(pixels, 5);
      //   clearSwatches();
      //   for (let pixel of palette) {
      //     const [r, g, b] = pixel.map((n) => n / 0xff);
      //     addSwatch(new Color("srgb", [r, g, b]).toString());
      //   }
      // }
    });
    paletteButton.style.width = "20px";

    let jsonTimer;
    const jsonButton = createButton("copy", () => {
      const colors = getSwatchColors().map((c) => serialize(new Color(c)));
      clearTimeout(jsonTimer);
      navigator.clipboard.writeText(JSON.stringify(colors));
      jsonButton.textContent = "copied!";
      jsonTimer = setTimeout(() => {
        jsonButton.textContent = "copy";
      }, 1500);
    });
    jsonButton.style.display = "none";

    window.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!curColor) return;
      if (!showLoupe) return;
      navigator.clipboard.writeText(curText);
      clearTimeout(clickTimer);
      loupeText.textContent = "Copied to clipboard!";
      addSwatch(curColor.toString());
      isCopying = true;
      updateLoupe();
      clickTimer = setTimeout(() => {
        loupeText.textContent = curText;
        isCopying = false;
        updateLoupe();
      }, 1500);
    });

    if (data.url) {
      image = await loadImage(data);
      resizeStyle();
      redraw(image, false);
    }

    window.addEventListener("resize", resizeStyle, { passive: true });

    window.addEventListener("mousemove", mouseHandler, { passive: true });

    // function extractPalette() {
    //   if (pixels) {
    //     const palette = quantize(pixels, 5);
    //     clearSwatches();
    //     for (let pixel of palette) {
    //       const [r, g, b] = pixel.map((n) => n / 0xff);
    //       addSwatch(new Color("srgb", [r, g, b]).toString());
    //     }
    //   }
    // }

    function getSwatchColors() {
      const prev = [...document.querySelectorAll(".picker-swatch")];
      return prev.map((c) => c.getAttribute("data-color"));
    }

    function clearSwatches() {
      const prev = [...document.querySelectorAll(".picker-swatch")];
      for (let e of prev) {
        if (e.parentElement) e.parentElement.removeChild(e);
      }
      jsonButton.style.display = "none";
    }

    function addSwatch(color) {
      const prevColors = new Set(getSwatchColors());

      if (prevColors.has(color)) return;

      const swatch = swatches.appendChild(document.createElement("div"));
      swatch.classList.add("picker-swatch");
      const size = 16;
      swatch.setAttribute("data-color", color);

      jsonButton.style.display = "";

      Object.assign(swatch.style, {
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
      });

      swatch.addEventListener(
        "click",
        (ev) => {
          if (ev.shiftKey) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (swatch.parentElement) {
              swatch.parentElement.removeChild(swatch);
              jsonButton.style.display =
                getSwatchColors().length > 0 ? "" : "none";
            }
          }
        },
        { passive: false }
      );
    }

    function redraw(image, doRender = true) {
      showLoupe = false;
      updateLoupe();
      const srcWidth = image.width;
      const srcHeight = image.height;

      const ratio = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);

      dstWidth = Math.floor(ratio * srcWidth);
      dstHeight = Math.floor(ratio * srcHeight);
      aspect = dstWidth / dstHeight;

      props.update({ dimensions: [dstWidth, dstHeight] });

      tmpCanvas.width = dstWidth;
      tmpCanvas.height = dstHeight;
      tmpContext.clearRect(0, 0, dstWidth, dstHeight);
      tmpContext.drawImage(image, 0, 0, dstWidth, dstHeight);
      const imgData = tmpContext.getImageData(0, 0, dstWidth, dstHeight);
      pixels = imgData.data;

      props.context.drawImage(image, 0, 0, dstWidth, dstHeight);
      // extractPalette();
      if (doRender) {
        props.play();
      }
    }

    function resizeStyle() {
      if (window.innerWidth / window.innerHeight > aspect) {
        props.canvas.style.height = "80vh";
        props.canvas.style.width = "auto";
      } else {
        props.canvas.style.width = "80vw";
        props.canvas.style.height = "auto";
      }
      updateMouse(-1, -1);
    }

    function mouseHandler(ev) {
      const { clientX, clientY } = ev;
      updateMouse(clientX, clientY, ev);
    }

    function updateMouse(clientX, clientY, ev) {
      const rect = props.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const u = x / rect.width;
      const v = y / rect.height;
      const px = Math.floor(u * dstWidth);
      const py = Math.floor(v * dstHeight);
      const insideImage = u >= 0 && u < 1 && v >= 0 && v < 1;

      let color;
      let insideSwatch = false;
      if (insideImage) {
        const pidx = px + py * dstWidth;
        const r = pixels[pidx * 4 + 0];
        const g = pixels[pidx * 4 + 1];
        const b = pixels[pidx * 4 + 2];
        color = new Color("srgb", [r / 0xff, g / 0xff, b / 0xff]);
      } else if (
        ev &&
        ev.target &&
        ev.target.classList &&
        ev.target.classList.contains("picker-swatch")
      ) {
        insideSwatch = true;
        color = new Color(ev.target.getAttribute("data-color"));
      }

      loupe.style.left = `${rect.left}px`;
      loupe.style.top = `${rect.bottom + 10}px`;
      // loupe.style.top = `${rect.top - loupeHeight - 10}px`;
      loupe.style.width = `${Math.round(rect.width)}px`;
      showLoupe = insideSwatch || insideImage;

      if (color) {
        loupe.style.backgroundColor = colorToStyle(color);
        curColor = color;
        curText = serialize(color);
        const contrastWithBlack = color.contrast("black", "apca");
        const textColor = contrastWithBlack < 50 ? "white" : "black";
        loupeText.style.color = textColor;
        loupeText.textContent = curText;
      }

      updateLoupe();
    }

    function serialize(c) {
      const m = modes[mode];
      if (m == "hex") return c.toString({ format: "hex" });
      else return c.to(m).toString({ precision: 4 });
    }

    function updateLoupe() {
      loupe.style.display = showLoupe ? "flex" : "none";
      document.body.style.cursor = showLoupe ? "crosshair" : "";
    }

    return (props) => {
      const { context, width, height } = props;
      resizeStyle();
    };
  }

  return canvasSketch(sketch, {
    styleCanvas: false,
    hotkeys: false,
    ...settings,
    ...opts,
  });
}

picker({
  data: {
    maxSize: 2048,
    crossOrigin: "anonymous",
    url: "images/gonz-ddl-nO2sfLUaxgg-unsplash.jpg",
  },
});
