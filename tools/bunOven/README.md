# bunOven fileProxy import

Send Bun jist JSONL into fileProxy instead of writing around Chisel.

```bash
bun tools/bunOven/import-jist-to-fileProxy.js doge.out
```

Replace mode:

```bash
bun tools/bunOven/import-jist-to-fileProxy.js doge.out --replace
```

fileProxy writes the traditional datastore under `data/transactions/<coin>/`, plus `data/imports/<coin>/`, `data/chords/<coin>/`, and a rebuilt `data/index/transactions.index.json`.
