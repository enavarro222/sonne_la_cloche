import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Roster } from "./Roster";

const lea = { id: "lea", name: "Léa" };
const tom = { id: "tom", name: "Tom" };
const zoe = { id: "zoe", name: "Zoé" };

function renderRoster() {
  const handlers = { onRemove: vi.fn(), onRecolour: vi.fn(), onMove: vi.fn() };
  render(<Roster roster={[lea, tom, zoe]} firstUp={lea} {...handlers} />);
  const sheet = (name: string) => {
    const li = screen.getByText(name).closest("li");
    if (!li) throw new Error(`no sheet for ${name}`);
    return li;
  };
  const colours = (name: string) =>
    screen.getByRole("button", { name: `Change ${name}'s colours` });
  return { ...handlers, sheet, colours };
}

/** A press that moves far enough to drag, held down. */
const startDrag = (sheet: HTMLElement) => {
  fireEvent.pointerDown(sheet, { button: 0, buttons: 1, pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(sheet, { buttons: 1, pointerId: 1, clientX: 80, clientY: 10 });
};

describe("Roster", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no pointer capture.
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves a dropped rider", () => {
    const { sheet, onMove } = renderRoster();
    startDrag(sheet("Léa"));
    fireEvent.pointerUp(sheet("Léa"), { pointerId: 1 });
    expect(onMove).toHaveBeenCalledWith("lea", expect.any(Number));
  });

  it("does not swallow the next tap after a cancelled drag", () => {
    const { sheet, colours, onMove, onRecolour } = renderRoster();
    startDrag(sheet("Léa"));
    // The system takes the touch over (a scroll, a call): no click follows.
    fireEvent.pointerCancel(sheet("Léa"), { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(10);
    });
    fireEvent.click(colours("Tom"));
    expect(onRecolour).toHaveBeenCalledWith("tom");
  });

  it("still swallows the click that ends a drag", () => {
    const { sheet, colours, onRecolour } = renderRoster();
    startDrag(sheet("Léa"));
    fireEvent.pointerUp(sheet("Léa"), { pointerId: 1 });
    fireEvent.click(colours("Léa"));
    expect(onRecolour).not.toHaveBeenCalled();
  });

  it("does not drag on a mouse passing over after a release out of the sheet", () => {
    const { sheet, onMove } = renderRoster();
    fireEvent.pointerDown(sheet("Léa"), {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    // Released elsewhere: the sheet never hears of it. Later, the mouse passes by.
    fireEvent.pointerMove(sheet("Léa"), { buttons: 0, pointerId: 1, clientX: 80, clientY: 10 });
    fireEvent.pointerUp(sheet("Léa"), { pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    expect(sheet("Léa").style.translate).toBe("");
  });

  it("moves a rider with Alt + arrows, without a pointer", () => {
    const { colours, onMove } = renderRoster();
    fireEvent.keyDown(colours("Tom"), { key: "ArrowRight", altKey: true });
    expect(onMove).toHaveBeenLastCalledWith("tom", 2);
    fireEvent.keyDown(colours("Tom"), { key: "ArrowLeft", altKey: true });
    expect(onMove).toHaveBeenLastCalledWith("tom", 0);
    // Not past the ends, and not without Alt.
    fireEvent.keyDown(colours("Léa"), { key: "ArrowLeft", altKey: true });
    fireEvent.keyDown(colours("Zoé"), { key: "ArrowRight" });
    expect(onMove).toHaveBeenCalledTimes(2);
  });
});
