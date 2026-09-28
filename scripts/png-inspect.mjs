import { inflateSync } from 'node:zlib';

// Pixel checks for generated PNG artifacts: no platform-specific image tools.
// Supports non-interlaced 8-bit RGB, RGBA and indexed PNG (including tRNS).
export function decodePng(buffer) {
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('PNG requerido');
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20), type = buffer[25];
  if (buffer[24] !== 8 || buffer[28] !== 0 || ![2, 3, 6].includes(type)) throw new Error('PNG 8-bit RGB/RGBA/indexado sin interlace requerido');
  const chunks = []; let palette, transparency;
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset), name = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (name === 'IDAT') chunks.push(data);
    if (name === 'PLTE') palette = data;
    if (name === 'tRNS') transparency = data;
    offset += length + 12;
  }
  const bytesPerPixel = type === 6 ? 4 : type === 2 ? 3 : 1;
  const stride = width * bytesPerPixel, raw = inflateSync(Buffer.concat(chunks)), decoded = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1), filter = raw[row];
    if (filter > 4) throw new Error('Filtro PNG inválido');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, a = x >= bytesPerPixel ? decoded[at - bytesPerPixel] : 0, b = y ? decoded[at - stride] : 0, c = y && x >= bytesPerPixel ? decoded[at - stride - bytesPerPixel] : 0;
      decoded[at] = (raw[row + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const at = i * bytesPerPixel, out = i * 4;
    if (type === 3) {
      const index = decoded[at];
      palette.copy(rgba, out, index * 3, index * 3 + 3); rgba[out + 3] = transparency?.[index] ?? 255;
    } else {
      decoded.copy(rgba, out, at, at + 3);
      const transparentRgb = transparency && type === 2 && [0, 1, 2].every((channel) => decoded[at + channel] === transparency.readUInt16BE(channel * 2));
      rgba[out + 3] = type === 6 ? decoded[at + 3] : transparentRgb ? 0 : 255;
    }
  }
  return { width, height, colorType: type, alphaChannel: type === 6 || !!transparency, rgba };
}

export function inspectPng(buffer) {
  const { rgba, ...image } = decodePng(buffer);
  const { width, height } = image;
  const pixel = (x, y) => [...rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
  const corners = [pixel(0, 0), pixel(width - 1, 0), pixel(0, height - 1), pixel(width - 1, height - 1)];
  let transparent = 0, partial = 0;
  const bounds = [width, height, -1, -1], contentBounds = [...bounds];
  const extend = (box, x, y) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, alpha = rgba[at + 3];
    if (alpha === 0) transparent++; else {
      if (alpha < 255) partial++;
      extend(bounds, x, y);
      if ([0, 1, 2, 3].some((channel) => rgba[at + channel] !== corners[0][channel])) extend(contentBounds, x, y);
    }
  }
  return { ...image, format: 'PNG', transparent, partial, corners, bounds, contentBounds };
}
