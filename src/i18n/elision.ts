/**
 * French elides "de" before a vowel sound ("d'Anne", "d'Hugo"). Translations
 * of keys taking a first name provide a `_elided` variant; languages without
 * elision just repeat the same text.
 */
export const elisionContext = (name: string): "elided" | undefined =>
  /^[aeiouyhœæ]/i.test(name.normalize("NFD")) ? "elided" : undefined;
