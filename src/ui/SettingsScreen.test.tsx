import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";
import { SettingsScreen } from "./SettingsScreen";

function renderSettings(testMode: boolean, settings: Settings = DEFAULT_SETTINGS) {
  const onChange = vi.fn();
  render(
    <SettingsScreen
      settings={settings}
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
    expect(group("What counts").getByRole("button", { name: "Distance" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(group("Slope").getByRole("button", { name: "Own slope each" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(group("What counts").getByRole("button", { name: "Leg speed" }));
    await userEvent.click(group("Rounds").getByRole("button", { name: "5 rounds" }));
    expect(onChange.mock.calls).toEqual([[{ metric: "cadence" }], [{ rounds: 5 }]]);
  });

  it("offers own slopes by distance only", () => {
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, metric: "cadence", slope: "gentle" }}
        testMode={false}
        onChange={() => undefined}
        onDone={() => undefined}
      />,
    );
    expect(group("Slope").getByRole("button", { name: "Own slope each" })).toBeDisabled();
    expect(group("Slope").getByRole("button", { name: /^Wall/ })).toBeEnabled();
  });
});

describe("SettingsScreen gears", () => {
  it("switches to virtual gears, the drivetrain asked only then", async () => {
    const onChange = renderSettings(false);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    await userEvent.click(group("Gears").getByRole("button", { name: "Virtual" }));
    expect(onChange).toHaveBeenLastCalledWith({ gears: "virtual" });
  });

  it("takes the real chainring and cog, once in range", async () => {
    const onChange = renderSettings(false, { ...DEFAULT_SETTINGS, gears: "virtual" });
    const cog = screen.getByRole("spinbutton", { name: "Cog" });
    expect(cog).toHaveValue(14);
    await userEvent.clear(cog);
    await userEvent.type(cog, "15");
    // "1" on the way is out of range: only 15 is taken.
    expect(onChange.mock.calls).toEqual([[{ cog: 15 }]]);
  });
});
