# qrField

qrField is a satellite utility for generating and printing QR-coded identifiers as physical labels.

Each sticker QR opens the Chisel GitHub Pages app with a random 16-character hexadecimal value in its URL fragment. Its frame color comes from that value.

It is designed to work alongside a complementary scanning tool, forming a bridge between physical objects and digital transaction workflows.

## Purpose

qrField exists to create portable, scannable identifiers that can be:

- printed onto stickers
- attached to physical items
- scanned later to recover embedded data

The system is intentionally simple:

- generate random value
- encode as QR
- visually differentiate via color
- recover via scan

## Data Format

Each sticker contains:

- a randomly generated 16-character HEX string
- encoded as the `sticker` fragment of a Chisel URL

Example:

a3f9c1d4e8b27f6a

This value is the only required payload.

## Sticker URLs and key fragments

Choose **Sticker URL (random ID)** to make 20 distinct stickers. Each QR points to `https://johnrigler.github.io/chisel/#sticker=<ID>`. Opening it brings up Chisel with that ID; scanning four sticker IDs later combines them left-to-right as the four 16-hex private-key fragments. Each sticker has a different random ID and its own matching frame color. The label has no printed text below the QR.

## Color Encoding

Each QR code is surrounded by a border color derived from the first six HEX characters of its ID.

This provides:

- quick visual differentiation
- a weak visual checksum
- human-recognizable grouping without scanning

The exact mapping is implementation-defined, but must be:

- deterministic
- derived solely from the HEX string

## System Model

qrField is one half of a two-part system:

1. qrField (this tool)
   - generates HEX values
   - renders QR codes
   - applies color encoding
   - outputs printable labels

2. Scanner (separate satellite)
   - scans QR codes
   - extracts HEX values
   - passes values into an application (e.g. WIF field, lookup, transaction flow)

Flow:

qrField → physical label → scanner → application → chisel

## Relationship to Chisel

The QR URL opens Chisel and passes the sticker ID in the fragment. Chisel's scanner can consume the same ID as one of four key fragments.

## Why This Is a Satellite

qrField depends on:

- rendering (canvas / SVG / print layout)
- physical output (paper, stickers)
- UI decisions (layout, batching, formatting)

These are not part of transaction logic.

Keeping this in a satellite:

- avoids bloating core
- allows rapid iteration on UX
- keeps physical workflows decoupled

## Use Cases

- labeling physical assets
- tagging objects for later transaction association
- creating offline identifiers
- bridging manual processes with digital systems
- pairing objects with future UTXO transactions

## Design Constraints

- no dependency on blockchain state
- no signing or key management
- no assumptions about how values are used later
- deterministic color derivation
- printable output as a first-class concern

## Notes

- HEX values should be generated using a secure random source
- collisions are unlikely but not impossible; handling is left to the consuming system
- printed format should prioritize scan reliability over density

## Summary

qrField generates physical entry points into digital systems.

It creates simple, scannable identifiers that can later be interpreted, enriched, and used in transaction flows.

It is intentionally minimal, external, and replaceable.
