import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { selectTransport } from "./transport";
import "./styles.css";

// Apply the persisted "reduce motion" pref before first paint (the Settings panel writes it).
try {
  if (localStorage.getItem("cq.reduceMotion") === "1") {
    document.body.classList.add("reduce-motion");
  }
} catch {
  // no storage in this webview — skip
}

const transport = selectTransport(
  window as unknown as Parameters<typeof selectTransport>[0],
);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
