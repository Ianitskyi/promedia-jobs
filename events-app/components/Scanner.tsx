"use client";

import { useRef, useState } from "react";
import { useQrScanner, type ScanControls } from "@/lib/hooks/useQrScanner";
import { extractTokenFromScan } from "@/lib/scan";
import { useI18n } from "@/lib/i18n/client";
import { ScannerResult, type ScannerResultData } from "@/components/ScannerResult";
import { ManualCheckin } from "@/components/ManualCheckin";

const RESULT_DISPLAY_MS = 2000;
const SCANNER_ELEMENT_ID = "qr-scanner-region";

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nice-to-have; never let it break scanning.
  }
}

export function Scanner({ eventId }: { eventId: string }) {
  const { dict } = useI18n();
  const processingRef = useRef(false);
  const [result, setResult] = useState<ScannerResultData | null>(null);
  const [networkError, setNetworkError] = useState(false);

  function resumeAfterDelay(controls: ScanControls) {
    setTimeout(() => {
      setResult(null);
      setNetworkError(false);
      processingRef.current = false;
      controls.resume();
    }, RESULT_DISPLAY_MS);
  }

  function showResult(data: ScannerResultData, controls: ScanControls) {
    setNetworkError(false);
    setResult(data);
    vibrate(data.state === "CHECKED_IN" ? 100 : [80, 60, 80]);
    resumeAfterDelay(controls);
  }

  async function handleDecoded(decodedText: string, controls: ScanControls) {
    if (processingRef.current) return;
    processingRef.current = true;
    controls.pause();

    const token = extractTokenFromScan(decodedText);
    if (!token) {
      showResult({ state: "INVALID_TICKET" }, controls);
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
        resumeAfterDelay(controls);
        return;
      }
      const body: ScannerResultData = await res.json();
      showResult(body, controls);
    } catch {
      setNetworkError(true);
      resumeAfterDelay(controls);
    }
  }

  const { cameraState } = useQrScanner(SCANNER_ELEMENT_ID, handleDecoded);

  return (
    <div className="flex flex-col">
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden bg-black">
        <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />

        {cameraState === "permission_denied" && (
          <CameraOverlay
            title={dict.scanner.cameraPermissionDeniedTitle}
            body={dict.scanner.cameraPermissionDeniedBody}
          />
        )}
        {cameraState === "unavailable" && (
          <CameraOverlay
            title={dict.scanner.cameraUnavailableTitle}
            body={dict.scanner.cameraUnavailableBody}
          />
        )}
        {networkError && (
          <CameraOverlay title={dict.scanner.networkErrorTitle} body={dict.scanner.networkErrorBody} />
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

export function CameraOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 px-6 text-center text-white">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm text-white/70">{body}</p>
    </div>
  );
}
