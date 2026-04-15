# ravenProxy

`ravenProxy` is a minimal server-side relay for broadcasting transactions
 and exposing a constrained subset of blockchain functionality.

It exists to support Chisel’s architecture without turning the node into an 
application server.

## Purpose

The proxy sits between the client and a full node.

It allows clients to:
- submit raw transactions
- access limited RPC functionality
- avoid exposing full node credentials or surface area

It does not:
- construct transactions
- sign transactions
- interpret application-level meaning

Its job is transport, not logic.

## Architecture


The proxy is intentionally thin. It should be easy to reason about and easy to replace.

## Responsibilities

- accept pre-built transactions
- forward them to the node
- return responses from the node
- optionally expose a small, controlled RPC surface

## Non-Responsibilities

- key management
- signing
- validation beyond basic sanity checks
- UI or workflow handling
- chain-specific application logic

If the proxy starts doing any of the above, it is no longer a proxy—it becomes part of the application and should be treated as a satellite instead.

## Design Constraints

- minimal API surface
- no business logic
- no persistent state (unless explicitly required)
- no assumptions about how transactions were created

## Deployment

`ravenProxy` is intended to run close to a full node.

Typical setups:
- local machine (development)
- private server
- controlled infrastructure environment

It should not be exposed broadly without access controls.

## Relationship to Chisel

Chisel depends on a proxy like `ravenProxy` to broadcast transactions,
 but does not depend on its specific implementation.

You can replace `ravenProxy` with:
- another thin proxy
- direct node access (if safe)
- a different transport layer

The only requirement is that it accepts raw transactions and forwards them.

## Summary

`ravenProxy` is a thin relay layer.

It exists to:
- reduce trust surface
- simplify client interaction with a node
- keep Chisel focused on transaction logic

Nothing more.
