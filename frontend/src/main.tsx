import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App.tsx";
import "./index.css";

// ✅ Red-brown brand theme applied globally
document.documentElement.style.setProperty("--brand-color", "#8B0000");
document.documentElement.style.setProperty("--brand-accent", "#A52A2A");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
