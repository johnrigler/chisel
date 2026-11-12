# Chisel broadcasts: static social preview publishing

Chisel's existing record links (`?mode=portal&coin=...&txid=...`) resolve
client-side and can be copied today. Social crawlers generally do not execute
that JavaScript, so linking the SPA directly does **not** reliably generate a
video card on X.

`tools/publish_broadcast.py` accepts a Chisel **DOWNLOAD JSON** export
(`chisel-record-v1`) and generates a small HTML page per transaction.
The page provides Open Graph/Twitter metadata server-side and redirects human
visitors to the existing Chisel record. No blockchain writes or dynamic server
are required for this step.

```sh
python3 tools/publish_broadcast.py chisel-digibyte-example.json \
  --site-url https://rigler.org/chisel/ \
  --output-root /srv/www/chisel \
  --category Music \
  --publisher John
```

This emits `/srv/www/chisel/broadcast/<coin>/<txid>/index.html`,
which should be served as
`https://rigler.org/chisel/broadcast/<coin>/<txid>/`.
**Do not share this URL until the generated file has been deployed to the
matching host.** If Chisel is hosted at a different URL, pass that URL instead
and deploy to its corresponding document root.

For YouTube media, the generator uses the video's public thumbnail URL and
the already-indexed title and description. Other media can supply
`summary.mediaCards[].thumbnailUrl` or `imageUrl`. The share page links
to Chisel, not YouTube. For social platforms to show large cards consistently,
use a valid HTTPS image URL and allow their crawlers to access it.

A category here is **publication metadata**, not a claim that a new category
field has been etched into the transaction. Longer term, FileProxy should
publish or regenerate these pages automatically when a new record is indexed,
with category and broadcaster identity validated against the ledger or a
separate signed annotation. For now, this is a manual tool.

The ledger is authoritative for transaction identity and on-chain payloads.
The generated HTML and the FileProxy interaction stream are re-creatable
off-chain publication layers. Availability of external video content is not
guaranteed by its on-chain reference.
