import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import App, { type Hero } from "./App";
import "./style.css";

const heroes: Record<Hero, string> = {
  b1: "B1 · Menu",
  b2: "B2 · Play first",
  b3: "B3 · Two lines",
  b4: "B4 · Account menu",
};

function LayoutLab() {
  const [hero, setHero] = useState<Hero>(() => {
    const requested = new URLSearchParams(location.search).get("hero");
    return requested && requested in heroes ? (requested as Hero) : "b1";
  });
  const choose = (next: Hero) => {
    setHero(next);
    history.replaceState(null, "", `?hero=${next}${location.hash}`);
  };
  return (
    <>
      <App layout="tabs" hero={hero} />
      <div className="lab-switcher" role="group" aria-label="Header option">
        {(Object.keys(heroes) as Hero[]).map((key) => (
          <button
            key={key}
            aria-pressed={hero === key}
            onClick={() => choose(key)}
          >
            {heroes[key]}
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
