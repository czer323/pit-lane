import { describe, expect, it } from "vite-plus/test";
import { isPublicPath, resolveGuardAction } from "./guard";

describe("resolveGuardAction", () => {
  it("redirects signed-out users away from app pages to /login", () => {
    expect(resolveGuardAction("/", false)).toBe("allow");
    expect(resolveGuardAction("/cars", false)).toBe("redirect-login");
    expect(resolveGuardAction("/races/42", false)).toBe("redirect-login");
  });

  it("allows signed-in users on app pages", () => {
    expect(resolveGuardAction("/", true)).toBe("allow");
    expect(resolveGuardAction("/cars", true)).toBe("allow");
    expect(resolveGuardAction("/races/42", true)).toBe("allow");
  });

  it("allows signed-out users on /login", () => {
    expect(resolveGuardAction("/login", false)).toBe("allow");
  });

  it("sends signed-in users away from /login to the app", () => {
    expect(resolveGuardAction("/login", true)).toBe("redirect-home");
  });
});

describe("isPublicPath", () => {
  it("treats /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("treats API routes as public", () => {
    expect(isPublicPath("/api/auth/get-session")).toBe(true);
    expect(isPublicPath("/api/anything")).toBe(true);
  });

  it("treats server function endpoints as public", () => {
    expect(isPublicPath("/_server/cars.listCars")).toBe(true);
  });

  it("treats app pages as private", () => {
    expect(isPublicPath("/cars")).toBe(false);
    expect(isPublicPath("/about")).toBe(false);
  });
});
