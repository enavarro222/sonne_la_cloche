import { useTranslation } from "react-i18next";
import {
  DURATIONS_SEC,
  METRICS,
  RESISTANCES,
  ROUND_COUNTS,
  type Settings,
  TEST_ONLY,
} from "../core/settings";
import styles from "./SettingsScreen.module.css";

interface Props {
  settings: Settings;
  /** Adds express games (5 s rides, 1 round) to try things out. */
  testMode: boolean;
  onChange: (settings: Partial<Settings>) => void;
  onDone: () => void;
}

interface ChoiceProps<T> {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onSelect: (option: T) => void;
  help?: string;
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  format,
  onSelect,
  help,
}: ChoiceProps<T>) {
  return (
    <fieldset className={styles.field}>
      <legend>{label}</legend>
      <div className={styles.choice}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === value}
            onClick={() => {
              onSelect(option);
            }}
          >
            {format(option)}
          </button>
        ))}
      </div>
      {help && <p className={styles.help}>{help}</p>}
    </fieldset>
  );
}

export function SettingsScreen({ settings, testMode, onChange, onDone }: Props) {
  const durations = DURATIONS_SEC.filter((d) => testMode || d !== TEST_ONLY.durationSec);
  const rounds = ROUND_COUNTS.filter((r) => testMode || r !== TEST_ONLY.rounds);
  const { t } = useTranslation();
  return (
    <div className={styles.settings}>
      <h1>{t("settings.title")}</h1>
      <Choice
        label={t("settings.metric.label")}
        options={METRICS}
        value={settings.metric}
        format={(metric) => t(`settings.metric.${metric}`)}
        onSelect={(metric) => {
          onChange({ metric });
        }}
        help={t("settings.metric.help")}
      />
      <Choice
        label={t("settings.duration.label")}
        options={durations}
        value={settings.durationSec}
        format={(count) => t("settings.duration.value", { count })}
        onSelect={(durationSec) => {
          onChange({ durationSec });
        }}
      />
      <Choice
        label={t("settings.rounds.label")}
        options={rounds}
        value={settings.rounds}
        format={(count) => t("settings.rounds.value", { count })}
        onSelect={(rounds) => {
          onChange({ rounds });
        }}
        help={t("settings.rounds.help")}
      />
      <Choice
        label={t("settings.resistance.label")}
        options={RESISTANCES}
        value={settings.resistance}
        format={(resistance) => t(`settings.resistance.${resistance}`)}
        onSelect={(resistance) => {
          onChange({ resistance });
        }}
        help={t("settings.resistance.help")}
      />
      <button type="button" className="primary" onClick={onDone}>
        {t("settings.done")}
      </button>
    </div>
  );
}
