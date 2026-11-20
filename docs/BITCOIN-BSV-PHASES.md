# Bitcoin and BSV phases

Direction recorded November 20, 2026. This supersedes the M64-first sequence
for this work. PHP implementations are protocol references; M64 development
is deferred. Preserve historical sources and readers for possible later use.

## Phase one: public accounts and testnet funding

Bitcoin mainnet, Bitcoin Testnet4, BSV mainnet and BSV testnet are explicit
choices in Chisel. This phase derives legacy P2PKH receive addresses, checks
balances through network-specific public APIs, and retrieves verified raw
transactions through the driver. It does not enable new-network signing or
broadcasting. The UI disables those actions, and the adapters reject them.

A WIF contains a 32-byte private key, network/version byte, optional compressed
public-key marker, and checksum. Importing a WIF for any installed chain can
derive the selected chain's account locally. Preserve its compression marker:
compressed and uncompressed public keys have different P2PKH addresses. The
same key may have the same address on BTC and BSV, and identical testnet address
formats do not establish which test chain holds coins.

Only public addresses leave the browser for balance queries. WIFs and private
keys remain in session memory. Public identity events contain no private data.
The cross-network list checks known P2PKH addresses once when a key is loaded;
CHECK ALL BALANCES refreshes it. The selected receive account is monitored
while the page is visible, including after it is funded. Delayed responses
from a previous network or identity cannot update the current receive view.
This is not HD-wallet, SegWit, Taproot, or exhaustive address discovery.

The testnet panel explains how to copy a public address, obtain the correct
network's free test coins from a faucet, and check receipt. Faucet availability,
login requirements and request limits are controlled by their operators.

- Bitcoin Testnet4: https://mempool.space/testnet4/faucet
- Bitcoin Testnet4 alternative: https://coinfaucet.eu/en/btc-testnet4/
- BSV testnet: https://bsvfaucet.com
- BSV funding guidance: https://hub.bsvblockchain.org/bsv-code-academy/beginner-path/beginner/development-environment

BSV was spoken as “BSC” during the phase-one request. This implementation follows
the preceding BSV discussion. Binance Smart Chain is not included by that alias.

## Phase two: ordinary transactions

Establish fixtures for construction, input verification, chain-specific signing,
fees, explicit review, broadcasting and confirmation on each testnet before
enabling corresponding mainnet capabilities. BSV signing requires its own
preimage rules and previous-output amounts. Existing Litecoin signing is not
evidence of BSV compatibility. Keep providers replaceable.

## Phase three: native file formats

- Bitcoin: Ordinal inscriptions, Taproot commit/reveal, witness parsing,
  inscription identifiers and sat-aware selection/transfers.
- BSV: recover earlier B:// files from johnrigler/bsv_write_bitcom; investigate
  BCAT and current 1Sat Ordinals independently.
- Identify the remembered Chinese alternative before claiming support. MetaID,
  ShowPay and MetaSV are research leads; distinguish old BSV records from newer
  cross-chain versions.
- CryptoGraffiti can supply a BSV-specific presentation client. Its BSV-only
  license remains relevant to reuse; do not copy it into multi-chain clients.

All new browser runtime code remains vanilla JavaScript and static/IPFS-compatible.
