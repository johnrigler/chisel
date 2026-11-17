# Chisel PWA installation follow-up (2026-11-16)

Status: **PWA installation and Android share target remain unverified.** These notes record the live test and next steps for a Work-mode development session; do not treat browser messages as proof of full offline functionality.

## Confirmed during test

- Repository: `johnrigler/chisel`; delivery on `main` through GitHub Pages.
- User saw **Chisel 2.8.43** at the GitHub Pages URL.
- Chisel activity messages reported **"PWA, update available, reload when ready"** and after refresh **"PWA offline shell registered"**. This confirms registration was reported, not that all routes and assets work offline.
- `manifest.webmanifest` exists with `display: standalone`, relative `start_url` and `scope`, SVG icon, and a GET `share_target` whose fields are `share_title`, `share_text`, and `opreturn`.
- `service-worker.js` and `chisel.pwa.js` were committed to main and linked from `index.html`, release `2.8.43`. Worker uses network-first caching for same-origin app shell and static assets, with offline fallback. No full dependency/offline test was completed.

## Observed browser installation problem

- Browser interface showed Chrome's **Cast, save, and share** submenu with **Cast**, **Save page as**, **Share / Copy link**, and a disabled **Create shortcut** option. No **Install app** or **Add to Home screen** was observed.
- **More tools** had options such as Name window, Show tabs vertically, Customize Chrome, Reading mode, Performance, Task manager, Take screenshot and Developer tools. No install action there.
- User invoked **Request mobile site**, which refreshed Chisel, but an install option still did not appear.
- The full URL was a GitHub Pages URL, not a `file://` local document. Exact address bar contents/browser environment were not independently captured. Do not infer browser installability from the service-worker message or assume the problem is definitively icons.

## Work-mode tasks

1. Reinspect current `main` first, because parallel Work and voice sessions can both make commits. Do not overwrite concurrent changes.
2. Check installation eligibility with Chrome DevTools Application > Manifest / Service Workers, inspecting warnings and scope. Confirm MIME and actual manifest, icon and worker responses on live GitHub Pages.
3. Add real **192x192** and **512x512** PNG icons (ideally maskable), referencing them in the manifest while retaining SVG. Do not assume this alone guarantees an install prompt.
4. Verify the Android/Chrome **share target** entry actually opens Chisel and that the query parameters are consumed correctly; the manifest declaration alone is not sufficient. Avoid automatically broadcasting shared data.
5. Test true offline launch after installation/cache warm-up, including missing dependencies, and test that new main releases invalidate caches safely without losing drafts, local keys, or active transactions. Do not cache RPC responses or sensitive data.
6. Confirm both desktop Chrome and Android Chrome behavior, including whether it is installed, running as a shortcut, or not offered as installable.
7. Make needed changes **directly on main** with the canonical `chisel.version.js` increment and required `?rev=` cache-key updates. Run relevant tests before declaring complete. Verify GitHub Pages release separately from GitHub commit.

User requested that these notes be saved to the project and will continue implementation via ChatGPT Work mode.
