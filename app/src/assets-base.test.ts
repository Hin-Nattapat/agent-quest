import { test, expect } from "bun:test";
import { assetUrl, joinAsset } from "./assets-base";

test("joinAsset returns the path unchanged when base is empty (dev)", () => {
  expect(joinAsset("", "/sprites/mage/t1/idle.png")).toBe("/sprites/mage/t1/idle.png");
});

test("joinAsset prefixes a webview base exactly once", () => {
  expect(joinAsset("vscode-webview://abc", "/sprites/x.png")).toBe(
    "vscode-webview://abc/sprites/x.png",
  );
});

test("joinAsset never doubles the slash when base has a trailing slash", () => {
  expect(joinAsset("vscode-webview://abc/", "/sprites/x.png")).toBe(
    "vscode-webview://abc/sprites/x.png",
  );
});

test("assetUrl returns the path unchanged when no base is set (dev)", () => {
  delete (globalThis as { window?: unknown }).window;
  expect(assetUrl("/sprites/x.png")).toBe("/sprites/x.png");
});

test("assetUrl prefixes the injected webview base", () => {
  (globalThis as { window?: { __CQ_ASSETS__?: string } }).window = {
    __CQ_ASSETS__: "vscode-webview://abc",
  };
  expect(assetUrl("/sprites/x.png")).toBe("vscode-webview://abc/sprites/x.png");
  delete (globalThis as { window?: unknown }).window;
});
