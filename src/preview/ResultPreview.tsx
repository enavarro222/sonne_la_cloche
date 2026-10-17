import { useEffect, useState } from "react";
import { renderResultCard } from "../share/resultCard";
import type { ShareContent } from "../share/shareContent";

/** A full party, to check the end-of-game image without playing one. */
const SAMPLE: ShareContent = {
  title: "Sonne la cloche !",
  winner: "Léa sonne la cloche !",
  ranking: [
    { rank: 1, name: "Léa", total: 412 },
    { rank: 2, name: "Tom", total: 398 },
    { rank: 3, name: "Papi Jean", total: 377 },
    { rank: 4, name: "Inès", total: 351 },
    { rank: 5, name: "Maxime", total: 342 },
    { rank: 6, name: "Zoé", total: 290 },
  ],
  awards: [
    { label: "Meilleur passage", value: "Léa · 151 mètres" },
    { label: "Jambes les plus rapides", value: "Tom · 132 tr/min" },
    { label: "Le plus costaud", value: "Papi Jean · 412 W" },
  ],
  date: "Partie du 15 octobre 2026",
  url: "https://sonnelacloche.enavarro.eu/fr/",
  text: "",
};

export function ResultPreview() {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    void renderResultCard(SAMPLE).then((blob) => {
      if (blob) setUrl(URL.createObjectURL(blob));
    });
  }, []);
  return url ? <img src={url} alt="" width={1080} height={1350} data-ready /> : null;
}
