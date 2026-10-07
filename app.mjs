import {SPP_UUID, QUERIES, PROFILES, profileFromFirmware, calibrationJob, hex} from './protocol.mjs';
const $ = id => document.getElementById(id);
let port = null, reader = null, readTask = null, closing = false, busy = false;
let received = new Uint8Array(), messages = [], sentBytes = 0, lastPrint = 'Not attempted', queried = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const textDecoder = new TextDecoder();
function record(message) {
  messages.push(`${new Date().toLocaleTimeString()} ${message}`);
  if (messages.length > 120) messages.shift();
  $('log').textContent = messages.join('\n');
}
function activity(message, error = false) { $('activity').textContent = message; $('activity').classList.toggle('error', error); }
function sync() {
  const connected = !!port?.writable;
  $('connect').hidden = connected;
  $('connect').disabled = busy || !navigator.serial || !window.isSecureContext;
  $('disconnect').hidden = !connected;
  $('disconnect').disabled = busy;
  $('readInfo').disabled = !connected || busy;
  $('print').disabled = !connected || busy || !$('confirmModel').checked || !PROFILES[$('profile').value];
  $('profile').disabled = busy;
  $('firmware').disabled = busy;
  $('confirmModel').disabled = busy;
  $('connectionStatus').classList.toggle('connected', connected);
  $('connectionStatus').innerHTML = `<i></i>${connected ? 'Connected over Bluetooth' : 'Not connected'}`;
}
function applyProfile() {
  const detected = profileFromFirmware($('firmware').value);
  if (detected) $('profile').value = detected;
  const profile = PROFILES[$('profile').value];
  $('profileNote').textContent = profile ? `Test uses a ${profile.widthMm} mm print area. The rectangle remains 40 × 20 mm.` : 'Two MHT-500 firmware families use different settings.';
  sync();
}
function interpret(bytes) {
  const merged = new Uint8Array(received.length + bytes.length);
  merged.set(received); merged.set(bytes, received.length);
  received = merged.slice(-16384);
  const text = textDecoder.decode(received);
  const firmware = text.match(/\b[A-Za-z0-9._-]*H20\d{8}[A-Za-z0-9._-]*\b/)?.[0] || text.match(/\bV\d+\.\d+\.20\d{6}\.I\d+\.\d+\b/)?.[0];
  if (firmware) {
    $('firmware').value = firmware;
    $('firmwareValue').textContent = firmware;
    applyProfile();
  }
  if (/MHT-500/i.test(text)) $('modelValue').textContent = 'MHT-500';
  else $('modelValue').textContent = 'Response received — see connection details';
}
async function readLoop() {
  while (port?.readable && !closing) {
    reader = port.readable.getReader();
    try {
      while (!closing) {
        const {value, done} = await reader.read();
        if (done) break;
        if (value?.length) {
          record(`Received ${hex(value)} | ${textDecoder.decode(value).replace(/[\x00-\x1f\x7f]/g, ' ')}`);
          interpret(value);
        }
      }
    } catch (error) {
      if (!closing) {record(`Receive error: ${error.message}`); activity('The printer connection was interrupted. Reconnect before another test.', true);}
      break;
    } finally {reader.releaseLock(); reader = null;}
  }
  if (!closing) await disconnect(true);
}
async function send(bytes, progress) {
  if (!port?.writable) throw new Error('Connect the printer first.');
  const writer = port.writable.getWriter();
  try {
    for (let offset = 0; offset < bytes.length; offset += 4096) {
      const chunk = bytes.subarray(offset, Math.min(offset + 4096, bytes.length));
      await writer.write(chunk);
      sentBytes += chunk.length;
      if (progress) progress(chunk.length);
      // Matches the official app: wait after each full 4096-byte block.
      if (chunk.length === 4096) await delay(100);
    }
  } finally {writer.releaseLock();}
}
async function disconnect(fromReadLoop = false) {
  if (closing) return;
  closing = true;
  try {if (reader) await reader.cancel();} catch {}
  // Wait for the reading task to release its lock before closing the port.
  if (!fromReadLoop && readTask) await readTask;
  try {await port?.close();} catch (error) {record(`Close: ${error.message}`);}
  port = null; closing = false; sync();
}
$('connect').addEventListener('click', async () => {
  busy = true; sync();
  try {
    const selected = await navigator.serial.requestPort({filters: [{bluetoothServiceClassId: SPP_UUID}]});
    await selected.open({baudRate: 115200});
    port = selected; received = new Uint8Array(); queried = false;
    $('modelValue').textContent = 'Connected — ready to read information';
    $('firmwareValue').textContent = '—';
    $('firmware').value = ''; $('profile').value = ''; $('confirmModel').checked = false;
    $('resultActions').hidden = true;
    record(`Connected. Browser service: ${JSON.stringify(selected.getInfo())}.`);
    activity('Connected. Read the printer information next.');
    readTask = readLoop();
  } catch (error) {
    record(`Connection: ${error.name}: ${error.message}`);
    activity(error.name === 'NotFoundError' ? 'No printer selected. A paired or saved printer is enough; Android settings do not need to show Connected. Fully close TattooPrinter and try again. If the printer is missing, follow the setup steps above and copy the report.' : `Could not connect: ${error.message}. Fully close TattooPrinter before retrying.`, true);
  } finally {busy = false; sync();}
});
$('disconnect').addEventListener('click', async () => {await disconnect(); record('Disconnected.'); activity('Printer disconnected.');});
$('readInfo').addEventListener('click', async () => {
  busy = true; queried = true; received = new Uint8Array(); sync();
  activity('Reading printer information…');
  try {
    for (const name of ['all', 'firmware', 'model']) {
      const query = new Uint8Array(QUERIES[name]);
      record(`Request ${name}: ${hex(query)}`);
      await send(query); await delay(1100);
    }
    activity(received.length ? 'Printer response received. Check the firmware and confirm the model.' : 'No information returned. Copy the report; you can also enter the firmware from TattooPrinter.', !received.length);
  } catch (error) {record(`Information read: ${error.message}`); activity(`Could not read information: ${error.message}`, true);}
  finally {busy = false; sync();}
});
$('firmware').addEventListener('input', () => {$('firmwareValue').textContent = $('firmware').value || '—'; applyProfile();});
$('profile').addEventListener('change', () => {
  const profile = PROFILES[$('profile').value];
  $('profileNote').textContent = profile ? `Test uses a ${profile.widthMm} mm print area. The rectangle remains 40 × 20 mm.` : 'Read or enter the firmware first.';
  sync();
});
$('confirmModel').addEventListener('change', sync);
$('print').addEventListener('click', async () => {
  const key = $('profile').value;
  if (!port?.writable || busy || !$('confirmModel').checked || !PROFILES[key]) return;
  busy = true; sync(); lastPrint = 'Transfer started';
  $('progress').hidden = false; $('progress').value = 0;
  $('resultActions').hidden = true; $('printResult').value = '';
  try {
    const parts = calibrationJob(key), total = parts.reduce((sum, part) => sum + part.length, 0);
    let completed = 0;
    record(`Calibration: ${key}, ${PROFILES[key].widthDots} dots, 256 rows, low density. Setup ${hex(parts[0])}; end ${hex(parts[2])}.`);
    activity('Sending the calibration pattern…');
    for (const part of parts) await send(part, count => {completed += count; $('progress').value = Math.round(100 * completed / total);});
    lastPrint = 'Bytes sent; physical result unconfirmed';
    $('resultActions').hidden = false;
    activity('Pattern sent. Check the paper and measure the rectangle.');
    record(`Calibration transfer completed: ${total} bytes. Physical result unconfirmed.`);
  } catch (error) {
    lastPrint = `Transfer interrupted: ${error.message}`; record(lastPrint);
    activity('Transfer interrupted. Power-cycle the printer before retrying, then copy the report.', true);
    await disconnect();
  } finally {busy = false; sync();}
});
$('printResult').addEventListener('change', () => {lastPrint = $('printResult').value || 'Bytes sent; physical result unconfirmed'; record(`Paper result: ${lastPrint}`);});
function report() {
  return {app: 'Stencil Link pilot 0.1.1',protocolSource: 'TattooPrinter 2.0.9.4 (153)',secureContext: window.isSecureContext,webSerial: !!navigator.serial,browser: navigator.userAgent,connected: !!port?.writable,printerConfirmedMHT500: $('confirmModel').checked,firmware: $('firmware').value || null,profile: $('profile').value || null,infoRequested: queried,totalBytesSent: sentBytes,printResult: lastPrint,connectionLog: messages.slice()};
}
$('copyReport').addEventListener('click', async () => {
  const text = JSON.stringify(report(), null, 2);
  try {await navigator.clipboard.writeText(text); $('copyReport').textContent = 'Report copied'; setTimeout(() => {$('copyReport').textContent = 'Copy report';}, 2200);}
  catch { $('log').textContent = text; document.querySelector('details').open = true; activity('Select and copy the report from the connection details.'); }
});
if (!window.isSecureContext || !navigator.serial) {
  $('browserNotice').hidden = false;
  $('browserNotice').textContent = !window.isSecureContext ? 'Open the hosted HTTPS version to connect to Bluetooth.' : 'This browser does not expose Bluetooth serial access. On Android, use an up-to-date Chrome (138 or later) and open the site directly in Chrome.';
}
if (navigator.serial) navigator.serial.addEventListener('disconnect', event => {
  if (event.target === port) {record('Printer disconnected unexpectedly.'); activity('The printer disconnected. Reconnect to continue.', true); void disconnect();}
});
const lifecycle = new AbortController();
if (document.modelContext?.registerTool) {
  try {Promise.resolve(document.modelContext.registerTool({name: 'read_stencil_connection_report',title: 'Read printer connection report',description: 'Read this browser’s connection report and user-reported calibration result. Does not connect, transmit printer commands, or print.',inputSchema: {type: 'object',properties: {},additionalProperties: false},annotations: {readOnlyHint: true,untrustedContentHint: true},execute(input) {if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.'); return report();}}, {signal: lifecycle.signal})).catch(() => {});} catch {}
}
window.addEventListener('pagehide', () => {lifecycle.abort(); void disconnect();});
sync();
