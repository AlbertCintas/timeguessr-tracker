import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/timeguessr-tracker/",
  build: {
    rollupOptions: {
      input: { main: "index.html", layouts: "layouts.html" },
    },
  },
});
