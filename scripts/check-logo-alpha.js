// Quick PNG pixel sampler: decodes 8-bit RGBA/RGB PNGs (filters 0-4) and prints samples.
const fs = require("fs");
const zlib = require("zlib");

const path = process.argv[2] || "assets/images/Logo.png";
const buf = fs.readFileSync(path);

// --- Parse chunks ---
let offset = 8;
let idat = Buffer.alloc(0);
let width, height, bitDepth, colorType;
while (offset < buf.length) {
  const len = buf.readUInt32BE(offset);
  const type = buf.toString("ascii", offset + 4, offset + 8);
  const data = buf.slice(offset + 8, offset + 8 + len);
  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === "IDAT") {
    idat = Buffer.concat([idat, data]);
  } else if (type === "IEND") break;
  offset += 12 + len;
}
console.log(`size: ${width}x${height}, bitDepth: ${bitDepth}, colorType: ${colorType} (6=RGBA, 2=RGB)`);
if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
  console.log("Unsupported format for this quick script.");
  process.exit(1);
}
const bpp = colorType === 6 ? 4 : 3;

// --- Decompress & unfilter ---
const raw = zlib.inflateSync(idat);
const stride = width * bpp;
const out = Buffer.alloc(height * stride);
const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const rowIn = y * (stride + 1) + 1;
  const rowOut = y * stride;
  for (let x = 0; x < stride; x++) {
    const rawv = raw[rowIn + x];
    const left = x >= bpp ? out[rowOut + x - bpp] : 0;
    const up = y > 0 ? out[rowOut - stride + x] : 0;
    const ul = y > 0 && x >= bpp ? out[rowOut - stride + x - bpp] : 0;
    let v;
    switch (filter) {
      case 0: v = rawv; break;
      case 1: v = rawv + left; break;
      case 2: v = rawv + up; break;
      case 3: v = rawv + ((left + up) >> 1); break;
      case 4: v = rawv + paeth(left, up, ul); break;
    }
    out[rowOut + x] = v & 0xff;
  }
}

const px = (x, y) => {
  const i = y * stride + x * bpp;
  return colorType === 6
    ? [out[i], out[i + 1], out[i + 2], out[i + 3]]
    : [out[i], out[i + 1], out[i + 2], 255];
};

const pts = {
  "top-left": [0, 0],
  "top-right": [width - 1, 0],
  "bottom-left": [0, height - 1],
  "bottom-right": [width - 1, height - 1],
  "mid-top": [width >> 1, 0],
  "mid-left": [0, height >> 1],
  "quarter-in": [width >> 2, height >> 2],
  center: [width >> 1, height >> 1],
};
for (const [name, [x, y]] of Object.entries(pts)) {
  console.log(name.padEnd(13), px(x, y));
}
