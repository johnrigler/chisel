# Chisel docs

Start here:

1. `origin.md` explains the vanilla-JS / elliptic signing decision, then maps the 2020 white paper into the current Chisel implementation.
2. `origin-print.html` is the printable meeting/review version of the same document.
3. `refactor-phases.md` defines the safe refactor order while the project has little automated testing.

The working rule is simple: Chisel artifacts are ledger-native. Tools such as fileProxy, bunOven, keeperBun, scanners, and label printers are satellites around that artifact model.
