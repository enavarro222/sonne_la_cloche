import { pathForLocale, pickLocale } from "./i18n/locales";

location.replace(pathForLocale(pickLocale(navigator.languages)) + location.search + location.hash);
