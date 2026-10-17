import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShareContent } from "./shareContent";
import { IMAGE_NAME, shareResults } from "./shareResults";

const content: ShareContent = {
  title: "Ring the Bell!",
  winner: "Léa rings the bell!",
  ranking: [],
  awards: [],
  date: "",
  url: "https://example.test/",
  text: "🔔 Léa rings the bell!",
};
const image = new Blob(["png"], { type: "image/png" });

function stubNavigator(props: Record<string, unknown>) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(navigator, key, { value, configurable: true });
  }
}

describe("shareResults", () => {
  afterEach(() => {
    for (const key of ["share", "canShare", "clipboard"]) Reflect.deleteProperty(navigator, key);
    vi.restoreAllMocks();
  });

  it("opens the share menu with the image and the text", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator({ share, canShare: () => true });
    expect(await shareResults(content, image)).toBe("shared");
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.text).toBe(content.text);
    expect(data.files?.[0]?.name).toBe(IMAGE_NAME);
    expect(data.files?.[0]?.type).toBe("image/png");
  });

  it("shares the text alone where files cannot be shared", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubNavigator({ share, canShare: () => false });
    expect(await shareResults(content, image)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: content.title, text: content.text });
  });

  it("does nothing more when the share menu is dismissed", async () => {
    stubNavigator({
      share: () => Promise.reject(new DOMException("dismissed", "AbortError")),
      canShare: () => true,
      clipboard: { writeText: vi.fn() },
    });
    expect(await shareResults(content, image)).toBe("cancelled");
  });

  it("downloads the image and copies the text where sharing is unavailable", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator({ clipboard: { writeText } });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => "blob:card");
    URL.revokeObjectURL = vi.fn();
    expect(await shareResults(content, image)).toBe("downloaded");
    expect(click).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(content.text);
  });

  it("falls back as well when sharing is refused", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator({
      share: () => Promise.reject(new DOMException("no", "NotAllowedError")),
      canShare: () => true,
      clipboard: { writeText },
    });
    expect(await shareResults(content, null)).toBe("downloaded");
    expect(writeText).toHaveBeenCalled();
  });

  it("reports a failure when nothing worked", async () => {
    stubNavigator({ clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    expect(await shareResults(content, null)).toBe("failed");
  });
});
