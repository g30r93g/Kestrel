/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 uses a CSS entrypoint; point the class-sorter at it.
  tailwindStylesheet: "./apps/web/src/app/globals.css",
};

export default config;
