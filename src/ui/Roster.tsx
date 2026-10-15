import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Livery, liveryOf } from "../core/livery";
import { MIN_PLAYERS, type Player } from "../core/players";
import { elisionContext } from "../i18n/elision";
import { cx } from "./cx";
import { Cyclist } from "./cyclist/Cyclist";
import { advanceCrank, GEAR_RATIO } from "./cyclist/geometry";
import styles from "./Roster.module.css";

// The players on the home screen, each on a small sheet of paper with their
// cyclist: tap the cyclist to change colours, drag the sheet to change the
// order of play (by hand: native drag and drop does not work on touch).

/** How the riders pedal while the screen waits: each at their own pace. */
const PACE = {
  /** Cadence (rpm) of a pedaling spell, drawn at random… */
  cadence: [40, 70],
  /** …a little brisker for the first to ride, who is getting ready. */
  eagerCadence: [60, 85],
  /** Length of a pedaling spell, then of a pause (s). */
  spell: [2.5, 7],
  pause: [1, 3.5],
  eagerPause: [0.6, 1.5],
  /** How quickly the legs reach a new cadence (s). */
  ramp: 0.6,
  /** How long the wheels keep rolling once the legs stop (s). */
  coast: 3,
} as const;

const between = ([low, high]: readonly [number, number]) => low + Math.random() * (high - low);

/** Where the cranks of a rider who waits stand: each one a little differently. */
const restingCrank = (index: number) => 0.7 + index * 2.1;

/**
 * A rider waiting their turn: spells of pedaling at a pace of their own, with
 * pauses where the legs stop and the wheels roll on and slow down. Still if
 * the device asks for less motion.
 */
function useIdlePedaling(index: number, eager: boolean) {
  const [motion, setMotion] = useState(() => ({
    crankAngle: restingCrank(index),
    wheelAngle: restingCrank(index) * GEAR_RATIO,
    rolling: false,
  }));
  useEffect(() => {
    const still =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    let pedaling = false;
    // Not all at once: each starts after a pause of their own.
    let phaseLeft = eager ? 0 : between([0, 2.5]);
    let target = 0;
    let cadence = 0;
    let wheelRate = 0;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      phaseLeft -= dt;
      if (phaseLeft <= 0) {
        pedaling = !pedaling;
        target = pedaling ? between(eager ? PACE.eagerCadence : PACE.cadence) : 0;
        phaseLeft = between(pedaling ? PACE.spell : eager ? PACE.eagerPause : PACE.pause);
      }
      cadence += (target - cadence) * Math.min(1, dt / PACE.ramp);
      // Driven by the legs, or rolling on and slowing down.
      const driven = (cadence / 60) * 2 * Math.PI * GEAR_RATIO;
      wheelRate = Math.max(driven, wheelRate * Math.exp(-dt / PACE.coast));
      setMotion((m) => ({
        crankAngle: advanceCrank(m.crankAngle, cadence, dt),
        wheelAngle: (m.wheelAngle + wheelRate * dt) % (2 * Math.PI),
        rolling: cadence > 20,
      }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [eager]);
  return motion;
}

/** A player's cyclist, in their colours, pedaling now and then while the screen waits. */
function RiderDrawing({ livery, eager, index }: { livery: Livery; eager: boolean; index: number }) {
  const { crankAngle, wheelAngle, rolling } = useIdlePedaling(index, eager);
  return (
    <Cyclist crankAngle={crankAngle} wheelAngle={wheelAngle} moving={rolling} livery={livery} />
  );
}

/** How far the pointer moves before a press becomes a drag (px). */
const DRAG_FROM = 8;

interface Drag {
  id: string;
  /** Where each sheet stands, in the order shown when the drag started. */
  slots: DOMRect[];
  /** Where the sheet was grabbed, from its top left corner. */
  grab: { x: number; y: number };
  /** The slot it would drop into, and how far it is from it (px). */
  index: number;
  offset: { x: number; y: number };
}

const nearest = (slots: readonly DOMRect[], x: number, y: number) => {
  let best = 0;
  slots.forEach((r, i) => {
    const b = slots[best];
    const d = (s: DOMRect) => Math.hypot(s.left + s.width / 2 - x, s.top + s.height / 2 - y);
    if (b && d(r) < d(b)) best = i;
  });
  return best;
};

interface Props {
  roster: readonly Player[];
  /** The first to ride, once there are enough players. */
  firstUp: Player | undefined;
  onRemove: (id: string) => void;
  onRecolour: (id: string) => void;
  onMove: (id: string, index: number) => void;
}

export function Roster({ roster, firstUp, onRemove, onRecolour, onMove }: Props) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null);
  // A drag ends with a click on what was under the finger: it must not count.
  const dragged = useRef(false);

  const startPress = (event: PointerEvent<HTMLLIElement>, id: string) => {
    if (event.button !== 0 || (event.target as Element).closest(`.${styles.remove}`)) return;
    press.current = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  const movePress = (event: PointerEvent<HTMLLIElement>) => {
    const start = press.current;
    if (start?.pointerId !== event.pointerId) return;
    // Released out of the sheet, unseen: a mouse passing over later must not drag it.
    if (event.buttons === 0) {
      endPress(true);
      return;
    }
    let current = drag;
    if (!current) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_FROM) return;
      const sheets = [...(listRef.current?.querySelectorAll(`.${styles.rider}`) ?? [])];
      const slots = sheets.map((sheet) => sheet.getBoundingClientRect());
      const from = roster.findIndex((p) => p.id === start.id);
      const origin = slots[from];
      if (!origin) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragged.current = true;
      current = {
        id: start.id,
        slots,
        grab: { x: start.x - origin.left, y: start.y - origin.top },
        index: from,
        offset: { x: 0, y: 0 },
      };
    }
    const index = nearest(current.slots, event.clientX, event.clientY);
    const slot = current.slots[index] ?? current.slots[0];
    if (!slot) return;
    setDrag({
      ...current,
      index,
      offset: {
        x: event.clientX - current.grab.x - slot.left,
        y: event.clientY - current.grab.y - slot.top,
      },
    });
  };

  const endPress = (cancelled: boolean) => {
    if (drag && !cancelled) onMove(drag.id, drag.index);
    press.current = null;
    setDrag(null);
    // The click that follows a drag is swallowed (below); once it has gone, or
    // when none comes (a cancelled drag), the next tap counts again.
    setTimeout(() => {
      dragged.current = false;
    }, 0);
  };

  // Without a pointer: Alt + ← or → moves a rider one place.
  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!event.altKey) return;
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const index = roster.findIndex((p) => p.id === id) + step;
    if (step === 0 || index < 0 || index >= roster.length) return;
    event.preventDefault();
    onMove(id, index);
  };

  // While dragging, the others make room: the sheet is shown at the slot it would drop into.
  const shown = drag
    ? (() => {
        const rest = roster.filter((p) => p.id !== drag.id);
        const moving = roster.find((p) => p.id === drag.id);
        return moving ? [...rest.slice(0, drag.index), moving, ...rest.slice(drag.index)] : roster;
      })()
    : roster;

  return (
    <>
      {/* Each player on their own sheet, with their bike; empty sheets until there are enough. */}
      <ul
        className={styles.roster}
        ref={listRef}
        onClickCapture={(event) => {
          if (!dragged.current) return;
          dragged.current = false;
          event.stopPropagation();
          event.preventDefault();
        }}
      >
        {shown.map((player) => {
          const livery = liveryOf(player);
          const isDragged = drag?.id === player.id;
          return (
            <li
              key={player.id}
              className={cx(
                styles.rider,
                player === firstUp && styles.next,
                isDragged && styles.dragging,
              )}
              style={isDragged ? { translate: `${drag.offset.x}px ${drag.offset.y}px` } : undefined}
              onPointerDown={(event) => {
                startPress(event, player.id);
              }}
              onPointerMove={movePress}
              onPointerUp={() => {
                endPress(false);
              }}
              onPointerCancel={() => {
                endPress(true);
              }}
            >
              <button
                type="button"
                className={styles.recolour}
                onClick={() => {
                  onRecolour(player.id);
                }}
                onKeyDown={(event) => {
                  moveByKey(event, player.id);
                }}
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                aria-label={t("home.players.recolour", {
                  name: player.name,
                  context: elisionContext(player.name),
                })}
              >
                <span className={styles.riderDrawing} aria-hidden="true">
                  <RiderDrawing
                    livery={livery}
                    eager={player === firstUp}
                    index={roster.indexOf(player)}
                  />
                </span>
                {/* A swatch of their colours: tap to change them. */}
                <span
                  className={styles.swatch}
                  style={{
                    background: `conic-gradient(${livery.jersey} 0 50%, ${livery.helmet} 0 75%, ${livery.frame} 0)`,
                  }}
                  aria-hidden="true"
                />
              </button>
              <span className={styles.riderName}>{player.name}</span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => {
                  onRemove(player.id);
                }}
                aria-label={t("home.players.remove", { name: player.name })}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          );
        })}
        {Array.from({ length: Math.max(0, MIN_PLAYERS - roster.length) }, (_, i) => (
          <li key={`empty-${String(i)}`} className={styles.emptySeat} aria-hidden="true">
            <span className={styles.riderDrawing}>
              <Cyclist crankAngle={restingCrank(roster.length + i)} />
            </span>
            <span className={styles.riderName} />
          </li>
        ))}
      </ul>
      {roster.length > 0 && <p className={styles.help}>{t("home.players.help")}</p>}
    </>
  );
}
