import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { switchLocale } from "../i18n/i18n";
import { isLocale, LOCALE_LABELS, LOCALES, pathForLocale } from "../i18n/locales";
import { cx } from "./cx";
import styles from "./Header.module.css";
import { useFullscreen } from "./useFullscreen";
import type { SensorState } from "./useSensor";

type Props = Pick<SensorState, "connection" | "connecting" | "error" | "reconnect">;

function useStatus({ connection, connecting, error }: Omit<Props, "reconnect">) {
  const { t } = useTranslation();
  if (connecting) return { text: t("status.connecting"), tone: undefined };
  switch (connection.kind) {
    case "none":
      return { text: t("status.idle"), tone: undefined };
    case "demo":
      return { text: t("status.demo"), tone: styles.ok };
    case "bluetooth":
      return connection.lost
        ? {
            // After a failed reconnection, say why rather than just "lost".
            text: error
              ? t(`home.errors.${error.code}`, { message: error.message })
              : t("status.lost"),
            tone: styles.ko,
          }
        : {
            text: t("status.connected", {
              name: connection.deviceName || t("status.unnamed"),
              protocol: connection.protocol,
            }),
            tone: styles.ok,
          };
  }
}

export function Header({ connection, connecting, error, reconnect }: Props) {
  const { t, i18n } = useTranslation();
  const status = useStatus({ connection, connecting, error });
  const lost = connection.kind === "bluetooth" && connection.lost;
  const fullscreen = useFullscreen();

  const onLanguageClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const locale = event.currentTarget.dataset.locale ?? "";
    if (!isLocale(locale)) return;
    // A real link (bookmarkable), but switching must not reload the page.
    event.preventDefault();
    switchLocale(locale);
  };

  return (
    <header className={styles.header}>
      <span className={styles.brand}>{t("app.title")}</span>
      <span className={cx(styles.status, status.tone)} role="status">
        {status.text}
      </span>
      {lost && (
        <button
          type="button"
          className="secondary"
          onClick={() => void reconnect()}
          disabled={connecting}
        >
          {t("status.reconnect")}
        </button>
      )}
      <nav className={styles.languages} aria-label={t("language.label")}>
        {LOCALES.map((locale) => (
          <a
            key={locale}
            href={pathForLocale(locale)}
            hrefLang={locale}
            lang={locale}
            data-locale={locale}
            aria-current={i18n.language === locale ? "page" : undefined}
            onClick={onLanguageClick}
          >
            {LOCALE_LABELS[locale]}
          </a>
        ))}
      </nav>
      {fullscreen.supported && (
        <button
          type="button"
          className={styles.fullscreen}
          onClick={fullscreen.toggle}
          aria-label={fullscreen.active ? t("fullscreen.exit") : t("fullscreen.enter")}
          title={fullscreen.active ? t("fullscreen.exit") : t("fullscreen.enter")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d={
                fullscreen.active
                  ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
                  : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
              }
            />
          </svg>
        </button>
      )}
    </header>
  );
}
