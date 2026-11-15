# Browser Page Context Across Voice and Work Sessions

Date: 2026-11-15

## Purpose

Record the observed difference between reading a live Chisel browser tab in a browser-connected Work session and discussing that page in ChatGPT Voice. This is operational guidance for future Chisel work; it is not a claim about every ChatGPT client or future product version.

## What was observed

- In a browser-connected Work session, the browser tool could read the selected Chisel tab's page context. The tab was Chisel 2.8.32 in Litecoin Portal mode. The readable context included page controls, a loaded public identity/address, balance, transaction history, and the selected record.
- The selected record was “Eric Clapton on Understanding JJ Cale's Music,” attributed to Amp Archives | Curated Rock History, in Litecoin block 3,207,894. The page offered a video link and controls for page metadata, notes, and comments.
- The page-context read showed a password-type WIF field, but no key value was reported. Never treat an empty-looking password control as proof that no secret exists elsewhere in page or browser memory.
- In a later Voice interaction, the assistant could refer to Chisel facts already written in the conversation, but it could not independently reread the live page because that interaction did not have the originating browser context. It therefore could not recover page data omitted from the conversation, such as the public Litecoin address.
- Dictation or a transcript in the conversation and an active browser attachment are different sources of context. A transcript or written summary does not itself attach the live page to another interaction mode.
- The user reports that Work time can run out. Chat is a useful continuation path for repository information, but it does not automatically inherit Work's live browser attachment.

## Chat, Work, and Voice distinctions

- ChatGPT's current experience choices include Chat, Work, and Codex. Voice is an interaction method available within supported experiences; being in a Voice conversation does not by itself establish whether its parent experience is Chat or Work.
- OpenAI's current help guidance says Voice can be used with Work on web and mobile. Therefore, do not tell the user they are in Chat merely because they are speaking, and do not infer browser access from Voice being active.
- Determine the parent experience from the visible Chat/Work selector or session context when available. Separately check whether the Chisel tab is attached and readable in that session. These are two distinct checks.
- Use Work with the connected browser when the task requires reading live Chisel page state. Record stable findings in the conversation or this note so the user can continue in Voice or Chat without repeating them.
- Treat recent notes as the record of what was observed at the time they were written. Rely on them for those historical observations. Recheck only when the user asks for current page state, the state may have changed, or the browser connection itself needs verification.

## Work-to-Chat handoff

Before ending a Work session, write a concise continuation note in the Chisel repository with:

- The goal and current status.
- Relevant file paths, page URLs, and records inspected.
- Decisions already made and facts that were directly observed.
- The next concrete action.
- Any open question that truly requires the user.

In Chat or Voice, consult that note before asking the user to repeat project information. If the current session cannot retrieve the repository itself, use the note's link or bring its concise summary into the conversation. Repository notes preserve recorded context; they do not provide live browser state. Do not put private keys, recovery phrases, or other secrets in a handoff note.

## Working procedure

1. When a request depends on current page state, check whether the relevant browser tab is available in the current session, then read it directly.
2. Before asking the user to repeat project information, consult the existing conversation and notes. Summarize known context and ask only for facts that are missing or necessary.
3. Do not claim that Voice or Chat can reread a live browser tab merely because an earlier Work session could. Test browser access in the current session before making that claim.
4. Distinguish facts present in the conversation or notes from facts requiring a fresh page read. For independent verification, use a fact that was not included in the summary.
5. A public repository or published document may provide a stable reference if the current mode can retrieve it, but publishing source code does not publish the user's live browser state or wallet context.
6. Avoid copying private keys, recovery phrases, or other secrets into summaries or repository notes. Include public addresses only when specifically needed and explicitly requested.

## Interpretation and limits

The observed failure was missing browser context in that Voice interaction, not evidence that voice transcription erased the conversation. Earlier responses gave inconsistent explanations, including an unsupported assumption that Voice meant Chat rather than Work. Future responses should report the actual mode and browser-connection evidence separately, rely on existing notes for recorded facts, and avoid assuming context transfers across modes. Recheck behavior after product or tool changes.

Current product reference: https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
