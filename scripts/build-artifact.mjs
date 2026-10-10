// Turns the single-file Vite build (dist-artifact/index.html) into a page body for a private Claude artifact.
// The artifact host supplies <!doctype>, <html>, <head> and <body>, so only the page's own tags are kept.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('dist-artifact/index.html', 'utf8');
const pick = (re) => [...src.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/g);
const fonts = pick(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = (src.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? [, ''])[1]
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
  .trim();

if (!scripts.length || !styles.length) throw new Error('Expected inlined <script> and <style> in dist-artifact/index.html');

const out = [...title, '<meta charset="utf-8">', ...fonts, ...styles, body, ...scripts].join('\n');
writeFileSync('dist-artifact/dailyrep.html', out);
console.log(`dist-artifact/dailyrep.html written (${(out.length / 1024).toFixed(0)} KB)`);
