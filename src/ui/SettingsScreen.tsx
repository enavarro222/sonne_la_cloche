import { useTranslation } from "react-i18next";
import { DURATIONS_SEC, METRICS, ROUND_COUNTS, type Settings } from "../core/settings";
import styles from "./SettingsScreen.module.css";

interface Props {
  settings: Settings;
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

export function SettingsScreen({ settings, onChange, onDone }: Props) {
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
        options={DURATIONS_SEC}
        value={settings.durationSec}
        format={(count) => t("settings.duration.value", { count })}
        onSelect={(durationSec) => {
          onChange({ durationSec });
        }}
      />
      <Choice
        label={t("settings.rounds.label")}
        options={ROUND_COUNTS}
        value={settings.rounds}
        format={(count) => t("settings.rounds.value", { count })}
        onSelect={(rounds) => {
          onChange({ rounds });
        }}
        help={t("settings.rounds.help")}
      />
      <button type="button" className="primary" onClick={onDone}>
        {t("settings.done")}
      </button>
    </div>
  );
}
