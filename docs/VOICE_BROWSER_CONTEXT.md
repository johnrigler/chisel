# Browser Page Context Across Voice and Work Sessions

Date: 2026-11-15

## Purpose

Record the observed difference between reading a live Chisel browser tab in a browser-connected Work session and discussing that page in ChatGPT Voice. This is operational guidance for future Chisel work; it is not a claim about every ChatGPT client or future product version.

## What was observed

- In a browser-connected Work session, the browser tool could read the selected Chisel tab's page context. The tab was Chisel 2.8.32 in Litecoin Portal mode. The readable context included page controls, a loaded public identity/address, balance, transaction history, and the selected record.
- The selected record was “Eric Clapton on Understanding JJ Cale's Music,” attributed to Amp Archives | Curated Rock History, in Litecoin block 3,207,894. The page offered a video link and controls for page metadata, notes, and comments.
- The page-context read showed a password-type WIF field, but no key value was reported. Never treat an empty-looking password control as proof that no secret exists elsewhere in page or browser memory.
- After switching to a Voice interaction, the assistant could refer to the Chisel facts already written in the conversation, but a browser-tool call failed because that Voice interaction did not have the originating browser context. It therefore could not independently reread the live page or recover page data omitted from the conversation, such as the public Litecoin address.
- Dictation text in the same conversation and an active browser attachment are different sources of context. A transcript or written summary does not itself attach the live page to another interaction mode.

## Working procedure

1. When the request depends on current page state, first confirm that the browser tab is available in the current session, then read the page directly.
2. Summarize the relevant facts in the conversation so they remain available when changing interaction modes.
3. Do not claim that Voice can reread a live browser tab merely because the earlier Work session could. Test the browser connection in the current mode before making that claim.
4. If Voice cannot access the page, distinguish facts present in the conversation from facts that require a fresh page read. For independent verification, ask for a fact that was not included in the summary.
5. A public repository or published document may provide a stable reference if the current mode can retrieve it, but publishing source code does not publish the user's live browser state or wallet context.
6. Avoid copying private keys, recovery phrases, or other secrets into summaries or repository notes. Include public addresses only when specifically needed and explicitly requested.

## Interpretation and limits

The observed failure was a missing browser context in that Voice interaction, not evidence that voice transcription erased the conversation. The assistant also gave inconsistent explanations earlier; future responses should report the actual connection result and avoid assuming that browser context transfers across modes. Recheck behavior after product or tool changes.
