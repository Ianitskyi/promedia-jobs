import { describe, it, expect } from "vitest";
import { can, type Permission } from "./authz";
import type { OrgRole } from "./database.types";

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "CHECKIN_STAFF"];

describe("can", () => {
  it("allows OWNER and ADMIN, but not CHECKIN_STAFF, to manage events", () => {
    expect(can("OWNER", "manageEvents")).toBe(true);
    expect(can("ADMIN", "manageEvents")).toBe(true);
    expect(can("CHECKIN_STAFF", "manageEvents")).toBe(false);
  });

  it("allows OWNER and ADMIN, but not CHECKIN_STAFF, to export attendees", () => {
    expect(can("OWNER", "exportAttendees")).toBe(true);
    expect(can("ADMIN", "exportAttendees")).toBe(true);
    expect(can("CHECKIN_STAFF", "exportAttendees")).toBe(false);
  });

  it("allows all three roles to check in attendees", () => {
    for (const role of ROLES) {
      expect(can(role, "checkIn")).toBe(true);
    }
  });

  it("never allows an unrecognized permission for any role (fail closed)", () => {
    for (const role of ROLES) {
      expect(can(role, "notARealPermission" as Permission)).toBe(false);
    }
  });
});
