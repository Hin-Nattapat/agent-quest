import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { sseTransport } from "./transport";
import "./styles.css";

const transport = sseTransport("/events");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
