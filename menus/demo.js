mainMenu.items.demo.html = `
      <section style="padding: 1em; font-family: sans-serif; line-height: 1.6;">
        <h1 style="margin-top: 0;">Chisel Demo Walkthrough</h1>

        <ol>
          <li>
            <strong>Get some Digibyte</strong><br>
            You'll need a small amount of DGB associated with a <strong>legacy v1 wallet address</strong> (begins with 'D').<br>
            Ways to get DGB:
            <ul>
              <li>Receive from a friend (ideal – like a sourdough starter)</li>
              <li>Use a faucet (if available)</li>
              <li>Buy on an exchange and transfer to your wallet</li>
            </ul>
          </li>

          <li>
            <strong>Decide what to inscribe</strong><br>
            What message or artifact do you want to etch into the blockchain?
            <ul>
              <li>A personal statement or haiku</li>
              <li>A public link: IPFS hash, video URL, or shared ChatGPT session</li>
              <li>A low-resolution PNG image (think: ordinal-style pixel art)</li>
            </ul>
          </li>

          <li>
            <strong>Tag it for future retrieval</strong><br>
            How will you or others find this again?
            <ul>
              <li>Use a <strong>MacDougall-style hashtag</strong> in the message</li>
              <li>Attach the inscription to a known address or label</li>
              <li>Index it on-chain using Thunderword or your own tagging scheme</li>
            </ul>
          </li>

          <li>
            <strong>Enter your private key (locally)</strong><br>
            To sign and send the transaction, you'll need your private key.<br>
            <em>This never leaves your browser.</em> You are safe because:
            <ul>
              <li>The site runs on pure Vanilla JS</li>
              <li>You can host it yourself (GitHub, IPFS, or local)</li>
              <li>You can inspect the code directly</li>
              <li>Tampermonkey integration is coming</li>
            </ul>
          </li>

          <li>
            <strong>Broadcast the transaction</strong><br>
            Chisel constructs a transaction using:
            <ul>
              <li>Your selected UTXO (unspent output)</li>
              <li>A tablet of text or image data</li>
              <li>An optional OP_RETURN field</li>
            </ul>
            It then broadcasts using either:
            <ul>
              <li>Your own configured digibyted + proxy</li>
              <li>A public blockchain API (default mode):
<a href="https://digibyteblockexplorer.com/sendtx" target="_blank" rel="noopener noreferrer">
    Send Transaction
</a></li>

            </ul>
          </li>

          <li>
            <strong>Record, share, and revisit</strong><br>
            Your inscription is now etched. Share the address, tag, or transaction ID with friends.<br>
            Use this tool later to search, decode, or visualize your etchings.
          </li>
        </ol>

        <p style="margin-top: 2em; font-style: italic; color: #666;">
          This demo helps you create your first permanent, decentralized message in the public record.
        </p>
      </section>
    `;
