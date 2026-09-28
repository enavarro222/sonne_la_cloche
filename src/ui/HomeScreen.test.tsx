import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../core/settings";
import { REPOSITORY_URL } from "./credits";
import { HomeScreen } from "./HomeScreen";

const noop = () => undefined;

describe("HomeScreen", () => {
  it("credits the author and links to the source code in a new tab", () => {
    render(
      <HomeScreen
        roster={[]}
        settings={DEFAULT_SETTINGS}
        sensor={{
          connection: { kind: "none" },
          connecting: false,
          error: null,
          ready: false,
          connect: () => Promise.resolve(),
          startDemo: noop,
        }}
        bluetoothSupported
        onAddPlayer={noop}
        onRemovePlayer={noop}
        onStart={noop}
        onOpenSettings={noop}
      />,
    );
    expect(screen.getByText("Made by enavarro222")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Source code on GitHub" });
    expect(link).toHaveAttribute("href", REPOSITORY_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
