import "@fontsource/instrument-serif/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const stored = localStorage.getItem("squeek-theme");
if (stored === "light" || stored === "dark") {
  document.documentElement.dataset.theme = stored;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
