import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.mts doesn't set test.globals, so React Testing Library's
// usual auto-registered afterEach(cleanup) (which relies on detecting a
// global afterEach) never fires — without this, multiple render() calls in
// the same test file accumulate in the jsdom document instead of each test
// starting fresh.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; several shadcn/next-themes hooks need it.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}
