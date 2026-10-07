# Stencil Link

An Android Chrome connection and calibration pilot for the MHT-500 tattoo stencil printer.

**[Open the app on GitHub Pages](https://meabefir.github.io/mht500-stencil-link/)**

The app uses Web Serial over Bluetooth Classic (SPP), with the normal print protocol reconstructed from the official TattooPrinter 2.0.9.4 Android app. Physical printing on the user's unit still needs verification.

## Use on Android

1. Open the GitHub Pages link in current Chrome (138 or later).
2. Pair the printer in Android's Bluetooth settings and close TattooPrinter.
3. Select **Connect printer**, then **Read printer information**.
4. Confirm the printer model and select the matching firmware settings.
5. Load stencil paper, print the calibration pattern, and measure its outer rectangle: **40 × 20 mm**.
6. Use **Copy report** to share the result manually.

Printer data stays in the browser. The website does not upload connection reports or printer responses. Printing begins only when the user presses the print button. No firmware-update commands are included.

## GitHub Pages

The static app is served from the root of `main`. GitHub Pages publishes updates after pushes to that branch. All asset paths are relative so the app works under a project Pages URL.

## Local checks

Requires Node.js:

```sh
node --check app.mjs
node --check protocol.mjs
node protocol-check.mjs
```

The protocol check covers setup-byte vectors, row framing and bit order, firmware selection, invalid input rejection, and calibration job lengths. It does not contact a printer.

For a local browser preview, serve this directory through a local HTTP server. Mobile Bluetooth access should be tested from the hosted HTTPS URL.

See [protocol findings](docs/protocol-findings.md) for the recovered commands, evidence, firmware differences and remaining hardware checks.
