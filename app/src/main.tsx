import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { selectTransport } from "./transport";
import "./styles.css";

const transport = selectTransport(
  window as unknown as Parameters<typeof selectTransport>[0],
);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);
