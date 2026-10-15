import "@fontsource/luckiest-guy/400.css";
import "@fontsource/mali/700.css";
import "../ui/theme.css";

import { createRoot } from "react-dom/client";
import { Card, Icon } from "./Preview";

// The link preview cards and the app icon, drawn with the game's own drawings.
// Rendered to public/ by scripts/og-image.ts: ?view=card&lang=fr, ?view=icon.

const params = new URLSearchParams(location.search);
// The icon's rounded corners stay transparent: no paper behind them.
if (params.get("view") === "icon") document.body.style.background = "none";
const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");
createRoot(root).render(
  params.get("view") === "icon" ? (
    <Icon maskable={params.has("maskable")} />
  ) : (
    <Card lang={params.get("lang") === "en" ? "en" : "fr"} />
  ),
);
