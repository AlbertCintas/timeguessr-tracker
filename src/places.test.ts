import assert from "node:assert/strict";
import test from "node:test";
import { placeName, type Places } from "./places.ts";

const data: Places = {
  regions: [
    ["FR", "Île-de-France"],
    ["ES", "Catalonia"],
    ["DE", "Berlin"],
    ["FJ", ""],
  ],
  places: [
    ["Versailles", 0, 48.8, 2.13, 84],
    ["Paris", 0, 48.85, 2.35, 2138],
    ["Paris 01 Louvre", 0, 48.86, 2.34, 16],
    ["Puigcerdà", 1, 42.43, 1.93, 9],
    ["Berlin", 2, 52.52, 13.41, 3426],
    ["Suva", 3, -18.14, 178.44, 77],
  ],
};

test("names the biggest town within 5 km, with its region", () => {
  assert.equal(placeName(data, 48.86, 2.34, "FR"), "Paris, Île-de-France");
  assert.equal(placeName(data, 48.79, 2.1, null), "Versailles, Île-de-France");
});

test("falls back to the nearest town when none is within 5 km", () => {
  assert.equal(placeName(data, 48.5, 1.9, "FR"), "Versailles, Île-de-France");
});

test("drops a region that repeats the town or is missing", () => {
  assert.equal(placeName(data, 52.5, 13.4, "DE"), "Berlin");
  assert.equal(placeName(data, -18, -179.9, null), "Suva");
});

test("prefers the picture's own country, then falls back to any", () => {
  assert.equal(placeName(data, 42.6, 2.0, "FR"), "Versailles, Île-de-France");
  assert.equal(placeName(data, 42.6, 2.0, "IT"), "Puigcerdà, Catalonia");
  assert.equal(placeName({ regions: [], places: [] }, 0, 0, null), null);
});
