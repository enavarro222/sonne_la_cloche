import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FixedDigits } from "./FixedDigits";

describe("FixedDigits", () => {
  it("boxes every digit and keeps the text intact", () => {
    const { container } = render(
      <p>
        <FixedDigits>{"12,5"}</FixedDigits>
      </p>,
    );
    expect(container.textContent).toBe("12,5");
    expect(container.querySelectorAll("span")).toHaveLength(3);
  });
});
