# Stencil Link

An Android Chrome connection and calibration pilot for the MHT-500 tattoo stencil printer.

**[Open the app on GitHub Pages](https://meabefir.github.io/mht500-stencil-link/)**

The app uses Web Serial over Bluetooth Classic (SPP), with the normal print protocol reconstructed from the official TattooPrinter 2.0.9.4 Android app. Physical printing on the user's unit still needs verification.

## Use on Android

1. Open the GitHub Pages link in current Chrome (138 or later).
2. Check whether Android lists the printer under **Paired devices** or **Saved devices**. It does not need to show **Connected** in settings; this website opens the printing connection.
3. If it is not paired yet, try connecting once through TattooPrinter and accept any Android pairing request. Then disconnect in TattooPrinter and fully close it (use Android's **App info → Force stop** if it keeps reconnecting).
4. Select **Connect printer** in this website, then **Read printer information**.
5. Confirm the printer model and select the matching firmware settings.
6. Load stencil paper, print the calibration pattern, and measure its outer rectangle: **40 × 20 mm**.
7. Use **Copy report** to share the result manually.

If pairing fails or the printer is absent from Chrome's chooser, share the report and describe whether it appears in Android's paired/saved list. Chrome's Bluetooth serial route uses paired Classic Bluetooth devices; TattooPrinter can initiate pairing while opening its native RFCOMM connection. See [Chrome's serial Bluetooth guide](https://developer.chrome.com/blog/serial-over-bluetooth) and [Android's connection guide](https://developer.android.com/develop/connectivity/bluetooth/connect-bluetooth-devices). A successful connection on the user's printer is still required to verify this route.

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
