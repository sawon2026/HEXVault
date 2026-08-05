import * as esbuild from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("media", { recursive: true });
const watch = process.argv.includes("--watch");

const ctx = await esbuild.context({
  entryPoints: ["webview-ui/src/main.tsx"],
  bundle: true,
  outfile: "media/webview.js",
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".tsx": "tsx", ".ts": "ts", ".css": "css" },
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
});

if (watch) {
  await ctx.watch();
  console.log("[webview] watching…");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("[webview] built media/webview.js");
}
