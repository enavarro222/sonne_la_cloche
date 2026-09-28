import styles from "./FixedDigits.module.css";

/**
 * Bungee has no tabular figures ("1" is much narrower than "0"): each digit
 * gets the same box so a running score or timer does not jitter.
 */
export function FixedDigits({ children }: { children: string | number }) {
  return (
    <>
      {(String(children).match(/\d|\D+/g) ?? []).map((part, i) =>
        /\d/.test(part) ? (
          <span key={i} className={styles.digit}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
