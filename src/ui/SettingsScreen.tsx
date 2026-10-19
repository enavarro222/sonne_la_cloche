import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DURATIONS_SEC,
  FINALES,
  GEARS,
  METRICS,
  ROUND_COUNTS,
  type Settings,
  SLOPE_PERCENT,
  slopeAllowed,
  SLOPES,
  TEETH,
  TEST_ONLY,
  ZWIFT_COGS,
} from "../core/settings";
import { type Remote, RemoteRow } from "./RemoteRow";
import styles from "./SettingsScreen.module.css";

interface Props {
  settings: Settings;
  /** Adds express games (5 s rides, 1 round) to try things out. */
  testMode: boolean;
  /** During a game: only what may change between two rides (see IN_GAME_SETTINGS). */
  inGame?: boolean;
  /** During a game, the Zwift remotes: one forgotten can be connected here. */
  remote?: Remote;
  onChange: (settings: Partial<Settings>) => void;
  onDone: () => void;
}

interface ChoiceProps<T> {
  label: string;
  options: readonly T[];
  value: T;
  format: (option: T) => string;
  onSelect: (option: T) => void;
  /** Options that cannot be picked with the other settings. */
  disabled?: (option: T) => boolean;
  help?: string;
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  format,
  onSelect,
  disabled,
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
            disabled={disabled?.(option)}
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

/** Teeth of the real chainring or cog: taken as soon as typed in range, put back on leaving. */
function Teeth({
  part,
  label,
  hideLabel = false,
  value,
  onChange,
}: {
  part: keyof typeof TEETH;
  label: string;
  /** Next to the cog list, the input speaks for itself: named for screen readers only. */
  hideLabel?: boolean;
  value: number;
  onChange: (teeth: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const { min, max } = TEETH[part];
  return (
    <label className={styles.teeth}>
      <span className={hideLabel ? "visually-hidden" : undefined}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft ?? value}
        onChange={(event) => {
          setDraft(event.target.value);
          const teeth = Number(event.target.value);
          if (Number.isInteger(teeth) && teeth >= min && teeth <= max) onChange(teeth);
        }}
        onBlur={() => {
          setDraft(null);
        }}
      />
    </label>
  );
}

/** The Zwift Cog's sizes, most single-cog trainers: picked rather than counted. */
function Cog({ cog, onChange }: { cog: number; onChange: (cog: number) => void }) {
  const { t } = useTranslation();
  const [other, setOther] = useState(!(ZWIFT_COGS as readonly number[]).includes(cog));
  return (
    <>
      <label className={styles.teeth}>
        <span>{t("settings.gears.cog")}</span>
        <select
          value={other ? "other" : String(cog)}
          onChange={(event) => {
            const value = event.target.value;
            setOther(value === "other");
            if (value !== "other") onChange(Number(value));
          }}
        >
          {ZWIFT_COGS.map((teeth) => (
            <option key={teeth} value={teeth}>
              {t(`settings.gears.zwiftCog${teeth}`)}
            </option>
          ))}
          <option value="other">{t("settings.gears.otherCog")}</option>
        </select>
      </label>
      {other && (
        <Teeth
          part="cog"
          label={t("settings.gears.cogTeeth")}
          hideLabel
          value={cog}
          onChange={onChange}
        />
      )}
    </>
  );
}

export function SettingsScreen({
  settings,
  testMode,
  inGame = false,
  remote,
  onChange,
  onDone,
}: Props) {
  const durations = DURATIONS_SEC.filter((d) => testMode || d !== TEST_ONLY.durationSec);
  const rounds = ROUND_COUNTS.filter((r) => testMode || r !== TEST_ONLY.rounds);
  const { t } = useTranslation();
  return (
    <div className={styles.settings}>
      <header className={styles.header}>
        <h1>{t("settings.title")}</h1>
        <button type="button" className="primary" onClick={onDone}>
          {t("settings.done")}
        </button>
      </header>
      {inGame && <p className={styles.help}>{t("settings.inGame")}</p>}
      <div className={styles.fields}>
        {!inGame && (
          <>
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
              label={t("settings.slope.label")}
              options={SLOPES}
              value={settings.slope}
              format={(slope) =>
                slope === "own"
                  ? t("settings.slope.own")
                  : t("settings.slope.option", {
                      name: t(`settings.slope.${slope}`),
                      percent: SLOPE_PERCENT[slope],
                    })
              }
              onSelect={(slope) => {
                onChange({ slope });
              }}
              disabled={(slope) => !slopeAllowed(slope, settings.metric)}
              help={t("settings.slope.help")}
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
          </>
        )}
        <Choice
          label={t("settings.finale.label")}
          options={FINALES}
          value={settings.finale}
          format={(finale) => t(`settings.finale.${finale}`)}
          onSelect={(finale) => {
            onChange({ finale });
          }}
          help={t("settings.finale.help")}
        />
        <fieldset className={styles.field}>
          <legend>{t("settings.gears.label")}</legend>
          <div className={styles.choice}>
            {GEARS.map((gears) => (
              <button
                key={gears}
                type="button"
                aria-pressed={gears === settings.gears}
                onClick={() => {
                  onChange({ gears });
                }}
              >
                {t(`settings.gears.${gears}`)}
              </button>
            ))}
          </div>
          {settings.gears === "virtual" && (
            <div className={styles.drivetrain}>
              <Teeth
                part="chainring"
                label={t("settings.gears.chainring")}
                value={settings.chainring}
                onChange={(chainring) => {
                  onChange({ chainring });
                }}
              />
              <Cog
                cog={settings.cog}
                onChange={(cog) => {
                  onChange({ cog });
                }}
              />
            </div>
          )}
          <p className={styles.help}>{t("settings.gears.help")}</p>
          {settings.gears === "virtual" && remote && <RemoteRow remote={remote} />}
        </fieldset>
      </div>
    </div>
  );
}
