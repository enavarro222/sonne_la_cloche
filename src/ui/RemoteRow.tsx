import { useTranslation } from "react-i18next";
import {
  type ZwiftButton,
  type ZwiftControllerState,
  ZWIFT_PRIMARY_TYPES,
  ZWIFT_SECONDARY_TYPES,
} from "home-trainer-kit";
import { cx } from "./cx";
import styles from "./RemoteRow.module.css";

export type Remote = Pick<
  ZwiftControllerState,
  "supported" | "connecting" | "controllers" | "lost" | "error" | "connect" | "reconnect"
>;

/** How a Zwift button shows when pressed. */
const BUTTON_SIGNS: Record<ZwiftButton, string> = {
  plus: "+",
  minus: "−",
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
  a: "A",
  b: "B",
  y: "Y",
  z: "Z",
};

/**
 * The Zwift remotes that shift, one line each, with the last button pressed:
 * a press shows it works. A Click v2's right pod is picked first (+ and B
 * shift); its left pod may be added for the −, though it answers only once
 * unlocked by Zwift's app (home-trainer-kit's docs/zwift-click-v2.md).
 */
export function RemoteRow({ remote }: { remote: Remote }) {
  const { t } = useTranslation();
  if (!remote.supported) return <p className={styles.help}>{t("home.remote.help")}</p>;
  const { controllers } = remote;
  return (
    <>
      {controllers.map((c) => (
        <div key={c.id} className={styles.row} data-testid="remote">
          <p className={cx(styles.state, !c.lost && styles.stateOk)} role="status">
            {c.lost
              ? t("home.remote.asleep", { name: c.name })
              : t("home.remote.device", { name: c.name })}
          </p>
          {!c.lost &&
            (c.lastButton ? (
              // Remounted on each press: it flashes again, even for the same button.
              <p key={c.presses} className={cx(styles.state, styles.pressed)}>
                {t("home.remote.pressed", { button: BUTTON_SIGNS[c.lastButton] })}
              </p>
            ) : (
              <p className={styles.help}>{t("home.remote.pressToTest")}</p>
            ))}
        </div>
      ))}
      <div className={styles.row}>
        {controllers.length === 0 ? (
          <button
            type="button"
            className="secondary"
            onClick={() => void remote.connect(ZWIFT_PRIMARY_TYPES)}
            disabled={remote.connecting}
          >
            {t("home.remote.connect")}
          </button>
        ) : (
          <>
            {remote.lost && (
              <button
                type="button"
                className="secondary"
                onClick={() => void remote.reconnect()}
                disabled={remote.connecting}
              >
                {t("home.remote.reconnect")}
              </button>
            )}
            {controllers.length === 1 && (
              <button
                type="button"
                className="secondary"
                onClick={() => void remote.connect(ZWIFT_SECONDARY_TYPES)}
                disabled={remote.connecting}
              >
                {t("home.remote.addLeft")}
              </button>
            )}
          </>
        )}
      </div>
      {remote.error && (
        <p className={styles.error} role="alert">
          {t("home.remote.failed", { message: remote.error })}
        </p>
      )}
      <p className={styles.help}>
        {controllers.length > 0 ? t("home.remote.sleeps") : t("home.remote.help")}
      </p>
    </>
  );
}
