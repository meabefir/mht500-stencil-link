// Independently reconstructed from TattooPrinter 2.0.9.4's MHT-500 path.
// Hardware validation is still required. This module sends no firmware updates.
export const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';
export const QUERIES = Object.freeze({all: [0x10, 0x04, 0x0a], firmware: [0x10, 0x04, 0x08], model: [0x10, 0x04, 0x06]});
export const PROFILES = Object.freeze({
  legacy: {name: 'Before August 2026', widthMm: 210, widthDots: 1680, rowBytes: 210, step: 16, mode: 2, low: 130, normal: 160, thick: 190},
  current: {name: 'August 2026 or later', widthMm: 208, widthDots: 1664, rowBytes: 208, step: 8, mode: 4, low: 100, normal: 120, thick: 150}
});
export const END_JOB = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1f, 0x01, 0x06]);

export function profileFromFirmware(version) {
  if (typeof version !== 'string') return null;
  // Matches the official app's date-after-H branch; other formats need inspection.
  const match = version.trim().match(/H(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (!match) return null;
  return Number(match[1] + match[2]) >= 202608 ? 'current' : 'legacy';
}

export function setupBytes(profileKey, density = 'low') {
  const profile = PROFILES[profileKey];
  if (!profile || !['low', 'normal', 'thick'].includes(density)) throw new Error('Choose a supported MHT-500 profile and density.');
  const result = [0x1b, 0x40];
  for (const [setting, value] of [[1, profile.step], [2, 100], [3, 1], [4, profile.mode], [5, 0], [6, profile[density]]]) {
    result.push(0x1f, 0xfd, 0x01, setting, value);
  }
  return new Uint8Array(result);
}

export function encodeRows(blackPixels, width, height) {
  if (!Number.isInteger(width) || width < 8 || width % 8 || width / 8 > 255 || !Number.isInteger(height) || height < 1 || height > 2400) {
    throw new Error('Raster dimensions are outside the supported row format.');
  }
  if (!(blackPixels instanceof Uint8Array) || blackPixels.length !== width * height) throw new Error('Raster pixel count does not match its dimensions.');
  const rowBytes = width / 8;
  const output = new Uint8Array((rowBytes + 4) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 4);
    output[rowStart] = 0x16;
    output[rowStart + 1] = rowBytes;
    for (let x = 0; x < width; x++) {
      const pixel = blackPixels[y * width + x];
      if (pixel !== 0 && pixel !== 1) throw new Error('Raster pixels must be black (1) or white (0).');
      if (pixel === 1) output[rowStart + 2 + (x >> 3)] |= 0x80 >> (x & 7);
    }
    output[rowStart + rowBytes + 2] = 0x15;
    output[rowStart + rowBytes + 3] = 0x01;
  }
  return output;
}

export function calibrationPixels(profileKey) {
  const profile = PROFILES[profileKey];
  if (!profile) throw new Error('Choose a supported printer profile.');
  const width = profile.widthDots, height = 256;
  const pixels = new Uint8Array(width * height);
  const left = (width - 320) / 2, top = 32;
  const line = (x1, y1, x2, y2) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) pixels[y * width + x] = 1;
  };
  // Border's outer bounds are 320 x 160 dots: exactly 40 x 20 mm at 8 dots/mm.
  line(left, top, left + 319, top + 1);
  line(left, top + 158, left + 319, top + 159);
  line(left, top, left + 1, top + 159);
  line(left + 318, top, left + 319, top + 159);
  line(left + 156, top + 75, left + 163, top + 84);
  for (let mm = 0; mm <= 40; mm += 10) {
    const x = left + Math.min(mm * 8, 319);
    line(x, 208, x, 223);
  }
  line(left, 223, left + 319, 223);
  return {pixels, width, height};
}

export function calibrationJob(profileKey) {
  const {pixels, width, height} = calibrationPixels(profileKey);
  return [setupBytes(profileKey, 'low'), encodeRows(pixels, width, height), END_JOB.slice()];
}

export function hex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase(); }
