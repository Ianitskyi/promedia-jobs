"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { extractTokenFromScan } from "@/lib/scan";
import { ScannerResult, type ScannerResultData } from "@/components/ScannerResult";
import { ManualCheckin } from "@/components/ManualCheckin";

const RESULT_DISPLAY_MS = 2000;
const SCANNER_ELEMENT_ID = "qr-scanner-region";

type CameraState = "starting" | "scanning" | "permission_denied" | "unavailable";

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nice-to-have; never let it break scanning.
  }
}

export function Scanner({ eventId }: { eventId: string }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [result, setResult] = useState<ScannerResultData | null>(null);
  const [networkError, setNetworkError] = useState(false);

  function resumeAfterDelay() {
    setTimeout(() => {
      setResult(null);
      setNetworkError(false);
      processingRef.current = false;
      scannerRef.current?.resume();
    }, RESULT_DISPLAY_MS);
  }

  function showResult(data: ScannerResultData) {
    setNetworkError(false);
    setResult(data);
    vibrate(data.state === "CHECKED_IN" ? 100 : [80, 60, 80]);
    resumeAfterDelay();
  }

  async function handleDecoded(decodedText: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    scannerRef.current?.pause(true);

    const token = extractTokenFromScan(decodedText);
    if (!token) {
      showResult({ state: "INVALID_TICKET" });
      return;
    }

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, token, method: "QR" }),
      });
      if (!res.ok) {
        setNetworkError(true);
        resumeAfterDelay();
        return;
      }
      const body: ScannerResultData = await res.json();
      showResult(body);
    } catch {
      setNetworkError(true);
      resumeAfterDelay();
    }
  }

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          if (cancelled) return;
          void handleDecoded(decodedText);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scanner lifecycle is intentionally mount-once
  }, []);

  return (
    <div className="flex flex-col">
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden bg-black">
        <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />

        {cameraState === "permission_denied" && (
          <CameraOverlay
            title="Camera permission denied"
            body="Allow camera access in your browser settings, then reload this page."
          />
        )}
        {cameraState === "unavailable" && (
          <CameraOverlay
            title="Camera unavailable"
            body="No camera could be started on this device."
          />
        )}
        {networkError && (
          <CameraOverlay title="Network error" body="Couldn't reach the server. Retrying scan…" />
        )}
        {result && (
          <div className="absolute inset-0">
            <ScannerResult {...result} />
          </div>
        )}
      </div>

      <ManualCheckin eventId={eventId} />
    </div>
  );
}

function CameraOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 px-6 text-center text-white">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-white/70">{body}</p>
    </div>
  );
}
