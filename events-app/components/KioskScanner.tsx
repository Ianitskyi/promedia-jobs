"use client";

import { useRef, useState } from "react";
import { useQrScanner, type ScanControls } from "@/lib/hooks/useQrScanner";
import { extractTokenFromScan } from "@/lib/scan";
import { useI18n } from "@/lib/i18n/client";
import { setKioskLocale } from "@/lib/i18n/actions";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CameraOverlay } from "@/components/Scanner";
import type { ScannerResultData } from "@/components/ScannerResult";

const RESULT_DISPLAY_MS = 2500;
const SCANNER_ELEMENT_ID = "kiosk-scanner-region";

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Best-effort only.
  }
}

interface KioskScannerProps {
  eventId: string;
  organizationName: string;
  logoUrl: string | null;
}

export function KioskScanner({ eventId, organizationName, logoUrl }: KioskScannerProps) {
  const { dict, locale, t } = useI18n();
  const processingRef = useRef(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [notRecognized, setNotRecognized] = useState(false);

  function reset(controls: ScanControls) {
    setTimeout(() => {
      setWelcomeName(null);
      setNotRecognized(false);
      processingRef.current = false;
      controls.resume();
    }, RESULT_DISPLAY_MS);
  }

  async function handleDecoded(decodedText: string, controls: ScanControls) {
    if (processingRef.current) return;
    processingRef.current = true;
    controls.pause();

    const token = extractTokenFromScan(decodedText);
    if (!token) {
      setNotRecognized(true);
      vibrate([80, 60, 80]);
      reset(controls);
      return;
    }

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, token, method: "KIOSK" }),
      });
      const body: ScannerResultData | { error: string } = await res.json();

      if (
        res.ok &&
        "state" in body &&
        (body.state === "CHECKED_IN" || body.state === "ALREADY_CHECKED_IN")
      ) {
        setWelcomeName(body.attendee?.firstName ?? dict.kiosk.guestFallbackName);
        vibrate(100);
      } else {
        setNotRecognized(true);
        vibrate([80, 60, 80]);
      }
    } catch {
      setNotRecognized(true);
    }
    reset(controls);
  }

  const { cameraState } = useQrScanner(SCANNER_ELEMENT_ID, handleDecoded);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher locale={locale} setLocale={setKioskLocale} />
      </div>

      <div className="flex items-center gap-3">
        <Logo name={organizationName} logoUrl={logoUrl} size={40} />
        <span className="font-serif text-xl italic">{organizationName}</span>
      </div>

      <div className="relative mt-10 aspect-square w-full max-w-md overflow-hidden bg-black">
        <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />
        {cameraState === "permission_denied" && (
          <CameraOverlay
            title={dict.kiosk.cameraPermissionDeniedTitle}
            body={dict.kiosk.cameraPermissionDeniedBody}
          />
        )}
        {cameraState === "unavailable" && (
          <CameraOverlay title={dict.kiosk.cameraUnavailableTitle} body={dict.kiosk.cameraUnavailableBody} />
        )}
        {welcomeName && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-600 text-white">
            <p className="text-3xl font-semibold">{t("kiosk.welcome", { name: welcomeName })}</p>
          </div>
        )}
        {notRecognized && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-700 text-white">
            <p className="text-2xl font-semibold uppercase tracking-wide">{dict.kiosk.notRecognizedTitle}</p>
            <p className="text-sm text-white/80">{dict.kiosk.notRecognizedBody}</p>
          </div>
        )}
      </div>

      <p className="mt-8 text-lg text-muted">{dict.kiosk.instruction}</p>
    </div>
  );
}
