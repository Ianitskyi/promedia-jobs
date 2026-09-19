import { describe, it, expect } from "vitest";
import en from "./en";
import uk from "./uk";

const BANNED_PHRASE = "Події без зайвої організаційної роботи";

describe("landing dictionary — English", () => {
  it("matches the required copy exactly", () => {
    expect(en.landing).toEqual({
      title: "ProMedia Events",
      description: "A service for creating events, registering participants, and managing attendance.",
      supportingText:
        "Create event pages, accept registrations, send QR tickets, and check participants in at the entrance.",
      primaryCta: "Create account",
      secondaryCta: "Sign in",
      capabilityRegistration: "Participant registration",
      capabilityQrTickets: "QR tickets",
      capabilityCheckIn: "Check-in",
      capabilityExport: "Participant list and export",
    });
  });
});

describe("landing dictionary — Ukrainian", () => {
  it("matches the required copy exactly", () => {
    expect(uk.landing).toEqual({
      title: "ProMedia Events",
      description: "Сервіс для створення подій, реєстрації учасників та контролю відвідування.",
      supportingText:
        "Створюйте сторінки подій, приймайте реєстрації, надсилайте QR-квитки та відмічайте учасників на вході.",
      primaryCta: "Створити акаунт",
      secondaryCta: "Увійти",
      capabilityRegistration: "Реєстрація учасників",
      capabilityQrTickets: "QR-квитки",
      capabilityCheckIn: "Check-in",
      capabilityExport: "Список та експорт учасників",
    });
  });

  it("never contains the disallowed marketing phrase", () => {
    expect(JSON.stringify(uk)).not.toContain(BANNED_PHRASE);
    expect(JSON.stringify(en)).not.toContain(BANNED_PHRASE);
  });
});
