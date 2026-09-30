import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Game } from "../core/game";
import { playerActivities } from "../export/fromGame";
import { encodePlayerActivity } from "../export/playerLink";
import { DEFAULT_LOCALE, isLocale } from "../i18n/locales";
import { cx } from "./cx";
import styles from "./StravaDialog.module.css";

interface Props {
  game: Game;
  onClose: () => void;
}

/** One QR code per player: it opens their game on their phone, ready for Strava. */
export function StravaDialog({ game, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [selected, setSelected] = useState(0);
  const [qr, setQr] = useState<{ index: number; src: string; url: string } | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const locale = isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const activities = playerActivities(game, locale);
  const activity = activities[selected];

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!activity) return;
    // An object, so the check below sees the cleanup's change.
    const run = { cancelled: false };
    void (async () => {
      const url = `${location.origin}/strava/#${await encodePlayerActivity(activity)}`;
      // Loaded only here: the game itself does not need it.
      const { default: QRCode } = await import("qrcode");
      const src = await QRCode.toDataURL(url, { margin: 2, width: 560, errorCorrectionLevel: "L" });
      if (!run.cancelled) setQr({ index: selected, src, url });
    })();
    return () => {
      run.cancelled = true;
    };
    // The activity is derived from the game and the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, selected, locale]);

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <h2 id={`${id}-title`}>{t("result.strava.title")}</h2>
        <div className={styles.body}>
          <ul className={styles.players}>
            {activities.map((a, index) => (
              <li key={a.name}>
                <button
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => {
                    setSelected(index);
                  }}
                >
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
          <figure className={styles.code}>
            {qr?.index === selected ? (
              <img src={qr.src} alt={t("result.strava.scan", { name: activity?.name ?? "" })} />
            ) : (
              <div className={styles.placeholder} aria-hidden="true" />
            )}
            <figcaption>{t("result.strava.scan", { name: activity?.name ?? "" })}</figcaption>
            {qr?.index === selected && (
              <a href={qr.url} target="_blank" rel="noopener" className={styles.here}>
                {t("result.strava.openHere")}
              </a>
            )}
          </figure>
        </div>
        <button
          ref={close}
          type="button"
          className={cx("secondary", styles.close)}
          onClick={onClose}
        >
          {t("result.strava.close")}
        </button>
      </div>
    </div>
  );
}
