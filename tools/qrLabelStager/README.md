# QR Label Stager

A separate Chisel label printer for Avery 5160-style 2.625 × 1 inch labels.

This tool does not modify or replace `tools/qrField/`.

## Features

- 3 × 10 Avery 5160 sheet staging
- partial-sheet slot selection
- medium QR on the left, explanatory text on the right
- two text boxes
- fixed QR payload mode
- base URL + random hex suffix mode
- per-slot generated values remain stable after staging
- fill all empty slots
- localStorage persistence
- JSON export/import
- FileProxy save/load using `http://localhost:7799`
- print history stored with the editable sheet data
- X/Y printer alignment offsets

Default FileProxy path:

`qrLabelStager/labels.json`

In seeded mode the final payload is:

`BASE + JOINER + RANDOM_HEX_SUFFIX`

For example:

`https://example.com/item/?id=9C5B56E37A7AA9F2`
