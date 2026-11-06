import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("the bare Chisel URL boots straight into Portal without adding a mode query", () => {
  assert.match(html, /<body data-mode="portal">/);
  assert.match(app, /let initialMode = "portal";/);
  assert.match(app, /searchParams\.get\("mode"\) \|\| "portal"/);
  assert.match(app, /normalizedMode === "portal" && !url\.searchParams\.has\("mode"\)/);
});

test("About is a first-class tab with its own panel", () => {
  assert.match(html, /data-mode-target="portal">Portal<\/button>/);
  assert.match(html, /data-mode-target="send">Send<\/button>/);
  assert.match(html, /data-mode-target="review">Review<\/button>/);
  assert.match(html, /data-mode-target="about">About<\/button>/);
  assert.match(html, /<section class="modePanel" data-mode-panel="about"/);
  assert.match(html, /body\[data-mode="about"\] \.modePanel\[data-mode-panel="about"\]/);
  assert.match(app, /"review" \|\| value === "portal" \|\| value === "about"/);
});

test("old Start links now lead to About while Examples and Tools remain accessible", () => {
  assert.match(app, /value === "origin" \|\| value === "start"/);
  assert.match(app, /value === "origin" \|\| value === "start"\) \{\s*return "about";/);
  assert.match(html, /data-mode-target="examples">Examples<\/button>/);
  assert.match(html, /data-mode-target="tools">Tools<\/button>/);
  assert.match(html, /id="demoStartButton"/);
  assert.match(html, /id="selfTestAllButton"/);
});

test("About explains current work, the author, and a public contact route", () => {
  const section = html.split('<section class="modePanel" data-mode-panel="about"')[1]?.split('<section class="modePanel" data-mode-panel="examples"')[0] || "";
  assert.match(section, /M64/);
  assert.match(section, /IPFS/);
  assert.match(section, /John Rigler/);
  assert.match(section, /systems hacking/);
  assert.match(section, /Get involved/);
  assert.match(section, /github\.com\/johnrigler\/chisel\/issues\/new/);
});
