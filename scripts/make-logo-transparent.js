// Makes the outer white background of Logo.png transparent and downscales it.
// Usage: node scripts/make-logo-transparent.js <in.png> <out.png> [size]
const fs = require("fs");
const zlib = require("zlib");

const inPath = process.argv[2] || "assets/images/Logo.png";
const outPath = process.argv[3] || "assets/images/Logo.png";
const targetSize = parseInt(process.argv[4] || "512", 10);

// ---------- Decode ----------
function decodePng(buf) {
  let offset = 8;
  let idat = Buffer.alloc(0);
  let width, height, colorType;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") idat = Buffer.concat([idat, data]);
    else if (type === "IEND") break;
    offset += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(idat);
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
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
  // Normalize to RGBA
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    rgba[j] = out[i * bpp];
    rgba[j + 1] = out[i * bpp + 1];
    rgba[j + 2] = out[i * bpp + 2];
    rgba[j + 3] = colorType === 6 ? out[i * bpp + 3] : 255;
  }
  return { width, height, data: rgba };
}

// ---------- Flood-fill outer near-white to transparent ----------
function clearOuterWhite(img, threshold) {
  const { width: w, height: h, data } = img;
  const visited = new Uint8Array(w * h);
  const stack = [];
  const isNearWhite = (i) => {
    const j = i * 4;
    return data[j] > threshold && data[j + 1] > threshold && data[j + 2] > threshold;
  };
  for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (visited[i]) continue;
    visited[i] = 1;
    if (!isNearWhite(i)) continue;
    const j = i * 4;
    data[j + 3] = 0;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
}

// ---------- Feather: soften light pixels touching transparency ----------
function featherEdges(img) {
  const { width: w, height: h, data } = img;
  const copy = Buffer.from(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (copy[j + 3] === 0) continue;
      const neighbors = [
        x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1,
        y > 0 ? i - w : -1, y < h - 1 ? i + w : -1,
      ];
      const touchesTransparent = neighbors.some((n) => n >= 0 && copy[n * 4 + 3] === 0);
      if (!touchesTransparent) continue;
      const lum = 0.299 * copy[j] + 0.587 * copy[j + 1] + 0.114 * copy[j + 2];
      if (lum > 200) data[j + 3] = Math.round(255 * ((lum - 200) / 55 + 0.15));
    }
  }
}

// ---------- Area-average downscale ----------
function resize(img, tw, th) {
  const { width: w, height: h, data } = img;
  const out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const sy0 = (ty * h) / th, sy1 = ((ty + 1) * h) / th;
    for (let tx = 0; tx < tw; tx++) {
      const sx0 = (tx * w) / tw, sx1 = ((tx + 1) * w) / tw;
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let y = Math.floor(sy0); y < Math.min(h, Math.ceil(sy1)); y++) {
        const fy = Math.min(y + 1, sy1) - Math.max(y, sy0);
        if (fy <= 0) continue;
        for (let x = Math.floor(sx0); x < Math.min(w, Math.ceil(sx1)); x++) {
          const fx = Math.min(x + 1, sx1) - Math.max(x, sx0);
          if (fx <= 0) continue;
          const cov = fx * fy;
          const j = (y * w + x) * 4;
          const al = data[j + 3] / 255;
          r += data[j] * al * cov; g += data[j + 1] * al * cov;
          b += data[j + 2] * al * cov; a += al * cov;
          count += cov;
        }
      }
      const o = (ty * tw + tx) * 4;
      const alphaAvg = count > 0 ? a / count : 0;
      if (a > 0.0001) {
        out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(alphaAvg * 255);
    }
  }
  return { width: tw, height: th, data: out };
}

// ---------- Encode ----------
function encodePng(img) {
  const { width, height, data } = img;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC-32 for PNG chunks
let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}

// ---------- Run ----------
let img = decodePng(fs.readFileSync(inPath));
console.log(`decoded ${img.width}x${img.height}`);
clearOuterWhite(img, 235);
featherEdges(img);
img = resize(img, targetSize, targetSize);
fs.writeFileSync(outPath, encodePng(img));
const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`wrote ${outPath} (${img.width}x${img.height}, ${kb} KB)`);
