import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App, { type Layout } from "./App";
import "./style.css";

const variants = {
  tabs: "A · Top tabs",
  sidebar: "B · Sidebar",
} as const;
type Variant = keyof typeof variants;

function LayoutLab() {
  const [variant, setVariant] = useState<Variant>(() => {
    const requested = new URLSearchParams(location.search).get("layout");
    return requested && requested in variants ? (requested as Variant) : "tabs";
  });
  const choose = (next: Variant) => {
    setVariant(next);
    history.replaceState(null, "", `?layout=${next}${location.hash}`);
  };
  return (
    <>
      <App layout={variant as Layout} />
      <div className="lab-switcher" role="group" aria-label="Layout variant">
        <span>Layout lab</span>
        {(Object.keys(variants) as Variant[]).map((key) => (
          <button
            key={key}
            aria-pressed={variant === key}
            onClick={() => choose(key)}
          >
            {variants[key]}
          </button>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LayoutLab />
  </React.StrictMode>,
);
