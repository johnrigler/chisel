# qrField

qrField is a satellite utility for generating and printing QR-coded identifiers as physical labels.

Each label encodes a 16-character hexadecimal string, paired with a deterministic color border derived from that value.

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

Each label contains:

- a randomly generated 16-character HEX string
- encoded directly into a QR code

Example:

a3f9c1d4e8b27f6a

This value is the only required payload.

## Color Encoding

Each QR code is surrounded by a border color derived from the HEX value itself.

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

qrField does not interact with Chisel directly.

Instead, it feeds systems that may later use Chisel.

Typical flow:

1. qrField generates and prints labels
2. Labels are attached to objects or stored
3. Scanner reads label
4. Application interprets HEX value
5. Value is used in a transaction or lookup via Chisel

This keeps Chisel unaware of:

- physical media
- QR encoding
- UI workflows

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
