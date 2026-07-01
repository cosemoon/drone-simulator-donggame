import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..", "..");

function readProjectFile(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("mobile installable app shell", () => {
  it("links the web app manifest from the HTML shell", () => {
    const html = readProjectFile("index.html");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  it("defines a standalone landscape PWA manifest for tablet play", () => {
    const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest"));

    expect(manifest.name).toBe("Drone Time Attack");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("landscape");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/drone-icon.svg",
          sizes: "512x512",
          purpose: "any maskable",
        }),
      ]),
    );
  });

  it("registers a production-only service worker", () => {
    const main = readProjectFile("src/main.tsx");
    const pwa = readProjectFile("src/pwa.ts");

    expect(main).toContain("registerPwa()");
    expect(pwa).toContain("import.meta.env.PROD");
    expect(pwa).toContain("navigator.serviceWorker.register");
    expect(pwa).toContain("/sw.js");
  });
});
