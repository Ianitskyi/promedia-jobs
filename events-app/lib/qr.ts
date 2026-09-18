import QRCode from "qrcode";

/** Renders a QR code for `data` as an inline SVG markup string. */
export async function renderQrSvg(data: string): Promise<string> {
  return QRCode.toString(data, { type: "svg", margin: 1, width: 320 });
}

/** Renders a QR code as a PNG data URL, for embedding in emails. */
export async function renderQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { margin: 1, width: 480 });
}
