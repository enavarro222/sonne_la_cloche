import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { feedbackAvailable, feedbackForm } from "./form";

const CONTEXT = { locale: "en", source: "phone", bike: "FTMS" } as const;

function mockFetch(response: Partial<Response> | Error) {
  const fetch = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function renderForm() {
  document.body.replaceChildren(feedbackForm(CONTEXT));
}

describe("feedback form", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("sends the message, the rating and the context, then thanks", async () => {
    const fetch = mockFetch({ ok: true });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Loved it" }));
    expect(screen.getByRole("button", { name: "Loved it" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Your message" }), "Great fun!");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your home trainer (optional)" }),
      "Elite Suito",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Your email (optional)" }),
      " parent@example.org ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Thank you! Your message reached the author.")).toBeVisible();
    // On the phone page, the rest of the page is still there: no way back needed.
    expect(screen.queryByRole("button", { name: "Back to the game" })).not.toBeInTheDocument();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/feedback");
    expect(JSON.parse(init.body as string)).toEqual({
      message: "Great fun!",
      rating: "great",
      trainer: "Elite Suito",
      email: "parent@example.org",
      locale: "en",
      source: "phone",
      bike: "FTMS",
      website: "",
    });
  });

  it("starts the home trainer field with the connected bike, explained", () => {
    document.body.replaceChildren(feedbackForm({ ...CONTEXT, trainer: "KICKR CORE 5A3B" }));
    const field = screen.getByRole("textbox", { name: "Your home trainer (optional)" });
    expect(field).toHaveValue("KICKR CORE 5A3B");
    expect(field).toHaveAccessibleDescription(/Make and model/);
  });

  it("offers the way back once sent, when there is one", async () => {
    mockFetch({ ok: true });
    const onBack = vi.fn();
    document.body.replaceChildren(feedbackForm(CONTEXT, onBack));
    await userEvent.type(screen.getByRole("textbox", { name: "Your message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back to the game" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("does not send an empty message", async () => {
    const fetch = mockFetch({ ok: true });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says when sending failed, and lets you try again", async () => {
    mockFetch(new Error("offline"));
    renderForm();
    await userEvent.type(screen.getByRole("textbox", { name: "Your message" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/Sending failed/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("keeps the bots' trap out of people's way", () => {
    renderForm();
    expect(screen.queryByRole("textbox", { name: /Website/ })).not.toBeInTheDocument();
  });
});

describe("feedbackAvailable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows the server's status, and says no without a server", async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ configured: true }) });
    expect(await feedbackAvailable()).toBe(true);
    mockFetch({ ok: false, status: 404 });
    expect(await feedbackAvailable()).toBe(false);
    mockFetch(new Error("offline"));
    expect(await feedbackAvailable()).toBe(false);
  });
});
