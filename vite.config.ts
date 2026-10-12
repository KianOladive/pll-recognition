import { defineConfig } from "vite";

// GitHub Pages serves the site from /pll-recognition/, so the build (and previewing it) need that base path.
// The dev server stays at / for convenience.
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/pll-recognition/" : "/",
}));
