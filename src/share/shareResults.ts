import type { ShareContent } from "./shareContent";

export type ShareOutcome = "shared" | "cancelled" | "downloaded" | "failed";

export const IMAGE_NAME = "sonne-la-cloche.png";

/**
 * Opens the device's share menu (WhatsApp, Signal, Messenger…) with the
 * results image and text. Where the browser cannot share, downloads the
 * image and copies the text instead. Must run from a user gesture.
 */
export async function shareResults(
  content: ShareContent,
  image: Blob | null,
): Promise<ShareOutcome> {
  const file = image && new File([image], IMAGE_NAME, { type: "image/png" });

  if (typeof navigator.share === "function") {
    // canShare is missing in some browsers that can share text only.
    const withImage =
      file !== null &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });
    try {
      await navigator.share(
        withImage
          ? { files: [file], title: content.title, text: content.text }
          : { title: content.title, text: content.text },
      );
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Otherwise (e.g. not allowed here): fall back below.
    }
  }

  let done = false;
  if (image) {
    const url = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.href = url;
    link.download = IMAGE_NAME;
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
    done = true;
  }
  try {
    await navigator.clipboard.writeText(content.text);
    done = true;
  } catch {
    // No clipboard access: the image alone will do.
  }
  return done ? "downloaded" : "failed";
}
