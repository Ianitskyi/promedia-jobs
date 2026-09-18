"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export type CameraState = "starting" | "scanning" | "permission_denied" | "unavailable";

export interface ScanControls {
  pause: () => void;
  resume: () => void;
}

/**
 * Owns the html5-qrcode camera lifecycle (start on mount, stop on
 * unmount) and continuous decode callback. Shared by the staff scanner
 * and the kiosk view — they differ only in how they render a decoded
 * result, not in how the camera is driven.
 *
 * `pause`/`resume` are handed to the callback at call time rather than
 * returned from the hook, so the caller's decode handler never needs
 * to close over this hook's own return value (which would make the
 * hook call and the handler each depend on the other's declaration
 * order).
 */
export function useQrScanner(
  elementId: string,
  onDecoded: (text: string, controls: ScanControls) => void,
) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onDecodedRef = useRef(onDecoded);
  const [cameraState, setCameraState] = useState<CameraState>("starting");

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  });

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId);
    scannerRef.current = scanner;
    let cancelled = false;
    const controls: ScanControls = {
      pause: () => scannerRef.current?.pause(true),
      resume: () => scannerRef.current?.resume(),
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (!cancelled) onDecodedRef.current(decodedText, controls);
        },
        () => {
          // Per-frame "no QR found" callback — expected constantly, ignore.
        },
      )
      .then(() => {
        if (!cancelled) setCameraState("scanning");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? "";
        setCameraState(name === "NotAllowedError" ? "permission_denied" : "unavailable");
      });

    return () => {
      cancelled = true;
      scanner.stop().catch(() => {});
    };
  }, [elementId]);

  return { cameraState };
}
