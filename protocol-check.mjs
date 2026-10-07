import assert from 'node:assert/strict';
import {encodeRows, setupBytes, calibrationJob, profileFromFirmware, hex} from './protocol.mjs';

// Independent expected wire vectors from the inspected application constants.
assert.equal(hex(setupBytes('legacy', 'normal')), '1B 40 1F FD 01 01 10 1F FD 01 02 64 1F FD 01 03 01 1F FD 01 04 02 1F FD 01 05 00 1F FD 01 06 A0');
assert.equal(hex(setupBytes('current', 'normal')), '1B 40 1F FD 01 01 08 1F FD 01 02 64 1F FD 01 03 01 1F FD 01 04 04 1F FD 01 05 00 1F FD 01 06 78');
const pixels = new Uint8Array(32);
for (const x of [0, 7, 8, 15]) pixels[x] = 1;
assert.equal(hex(encodeRows(pixels, 16, 2)), '16 02 81 81 15 01 16 02 00 00 15 01');
assert.throws(() => encodeRows(new Uint8Array(7), 7, 1));
assert.throws(() => encodeRows(new Uint8Array(16), 16, 2));
assert.throws(() => setupBytes('unknown'));
assert.equal(profileFromFirmware('PM500203H2026073101'), 'legacy');
assert.equal(profileFromFirmware('PM500203H2026080101'), 'current');
assert.equal(profileFromFirmware('PM500203H2026000101'), null);
assert.equal(profileFromFirmware('V1.0.20260801.I1.0'), null);
assert.equal(calibrationJob('legacy').reduce((sum, bytes) => sum + bytes.length, 0), 54822);
assert.equal(calibrationJob('current').reduce((sum, bytes) => sum + bytes.length, 0), 54310);
console.log('Protocol vectors, row bit order, firmware boundaries, and job lengths passed. Hardware unverified.');

