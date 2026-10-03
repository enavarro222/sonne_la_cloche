import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import { SettingsScreen } from "./SettingsScreen";

function renderSettings(testMode: boolean) {
  const onChange = vi.fn();
  render(
    <SettingsScreen
      settings={DEFAULT_SETTINGS}
      testMode={testMode}
      onChange={onChange}
      onDone={() => undefined}
    />,
  );
  return onChange;
}

const group = (name: string) => within(screen.getByRole("group", { name }));

describe("SettingsScreen", () => {
  it("keeps the express games for test mode", () => {
    renderSettings(false);
    expect(group("Ride length").queryByRole("button", { name: "5 s" })).not.toBeInTheDocument();
    expect(group("Rounds").queryByRole("button", { name: "1 round" })).not.toBeInTheDocument();
  });

  it("offers them in test mode", () => {
    renderSettings(true);
    expect(group("Ride length").getByRole("button", { name: "5 s" })).toBeInTheDocument();
    expect(group("Rounds").getByRole("button", { name: "1 round" })).toBeInTheDocument();
  });

  it("shows the current choices, and changes only the one picked", async () => {
    const onChange = renderSettings(false);
    expect(group("What counts").getByRole("button", { name: "Leg speed" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(group("What counts").getByRole("button", { name: "Strength (watts)" }));
    await userEvent.click(group("Rounds").getByRole("button", { name: "5 rounds" }));
    expect(onChange.mock.calls).toEqual([[{ metric: "power" }], [{ rounds: 5 }]]);
  });
});
