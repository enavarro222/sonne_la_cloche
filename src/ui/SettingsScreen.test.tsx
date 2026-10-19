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

  it("keeps saying what virtual gears are for, once on", () => {
    renderSettings(false, { ...DEFAULT_SETTINGS, gears: "virtual" });
    expect(screen.getByText(/single cog \(Zwift Cog…\)/)).toBeInTheDocument();
  });

  it("picks a Zwift Cog from the list, counting teeth only for another cog", async () => {
    const onChange = renderSettings(false, { ...DEFAULT_SETTINGS, gears: "virtual" });
    const cog = screen.getByRole("combobox", { name: "Cog" });
    expect(cog).toHaveValue("14");
    expect(screen.queryByRole("spinbutton", { name: "Cog teeth" })).not.toBeInTheDocument();
    await userEvent.selectOptions(cog, "Zwift Cog Elite/Garmin (18)");
    expect(onChange).toHaveBeenLastCalledWith({ cog: 18 });
    await userEvent.selectOptions(cog, "Other");
    const teeth = screen.getByRole("spinbutton", { name: "Cog teeth" });
    onChange.mockClear();
    await userEvent.clear(teeth);
    await userEvent.type(teeth, "15");
    // "1" on the way is out of range: only 15 is taken.
    expect(onChange.mock.calls).toEqual([[{ cog: 15 }]]);
  });

  it("takes the real chainring once in range", async () => {
    const onChange = renderSettings(false, { ...DEFAULT_SETTINGS, gears: "virtual" });
    const chainring = screen.getByRole("spinbutton", { name: "Chainring" });
    await userEvent.clear(chainring);
    await userEvent.type(chainring, "36");
    expect(onChange.mock.calls).toEqual([[{ chainring: 36 }]]);
  });
});

describe("SettingsScreen during a game", () => {
  const remote = () => ({
    supported: true,
    connecting: false,
    controllers: [],
    lost: false,
    error: null,
    connect: vi.fn(() => Promise.resolve()),
    reconnect: vi.fn(() => Promise.resolve()),
  });

  it("only offers how the bike is ridden, and a remote forgotten", async () => {
    const zwift = remote();
    render(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, gears: "virtual" }}
        testMode={false}
        inGame
        remote={zwift}
        onChange={vi.fn()}
        onDone={() => undefined}
      />,
    );
    expect(screen.queryByRole("group", { name: "Rounds" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Gears" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect the Zwift remote" }));
    expect(zwift.connect).toHaveBeenCalled();
  });
});
