
const fileWalletInput = document.createElement('input');
 fileWalletInput.type = 'file';
 fileWalletInput.id = 'btn-load-wallet';
 fileWalletInput.accept = '.json';
//  fileWalletInput.style.display = 'none';

mainMenu.items.wallet.html = `
<h1 style="margin: 0 1em;">Create, Import, or Load a Wallet</h1>

<p style="margin: 0 1em 1em;">
  To use Chisel on Digibyte, you need a wallet holding keys to prove authorship, sign messages, and spend DGB.
</p>

<ul style="margin: 0 2em 1em;">
  <li><strong>Create</strong> a new wallet with a random 12-word seed phrase</li>
  <li><strong>Import</strong> an existing wallet via your 12-word seed phrase</li>
  <li><strong>Load</strong> an existing wallet from a saved wallet</li>
</ul>

<p style="margin: 0 1em 1.5em;">
  <strong>IMPORTANT:</strong> Your seed phrase is your only wallet access. Store it securely. Losing it means losing access to funds. Your inscriptions remain accessible.
</p>

<div class="button-row" style="margin: 0 1em;">
  <button id="btn-create-wallet" onclick="mainMenu.items.wallet.renderCreateWallet()">Create New Wallet</button>
  <button id="btn-import-wallet" onclick="mainMenu.items.wallet.renderImportWallet()">Import Existing Wallet</button>
  <button id="btn-load-wallet"   onclick="mainMenu.items.wallet.renderLoadWallet()">Load Wallet from File</button>
</div>

    `;

mainMenu.items.wallet.renderCreateWallet = function(containerId = "main") {
    const container = document.getElementById(containerId);
    if (!container) return;

//    chiselMenu[thisItem].dirty = 1;   

    account=dgb.util.getMnemonicAddress("")

   mainMenu.items.wallet.created_html = `<div>
  <div id="mnemonic-box" style="margin-top:1em; padding:1em; border:1px solid #ccc; font-family:monospace;">${account.node.mnemonic.phrase}</div>
  <p style="font-size:0.9em; color:white; max-width:400px;">
    This is your secret recovery phrase. Never share it. Anyone with these words can access your wallet. Write it down and store it securely.
    <div class="button-row">
      <button id="btn-confirm-wallet" onclick="mainMenu.items.wallet.renderConfirmWallet('main')"> Got it!  </button>
    </div>

  </p>
</div>
`;

document.querySelector('#section-wallet').innerHTML = mainMenu.items.wallet.created_html

};

mainMenu.items.wallet.renderConfirmWallet = function renderConfirmWallet(containerId = "main") {
    const container = document.getElementById(containerId);
    if (!container) return;

    console.log(account)

    hotdog.innerHTML = account.address;
      hotdog.style = `
       position: fixed; top: 10px; right: 60px;
       font-size: 12px; z-index: 9999; cursor: pointer;
       color: green; background: black; padding: 4px 10px;
       border-radius: 5px;
  `;

   mainMenu.items.wallet.final_html = `<div id="user-id-box" style="border:1px solid #ccc; padding:1em; width:fit-content; text-align:center; font-family:sans-serif;">
  <div style="font-weight:bold; margin-bottom:0.5em;">Your User ID</div>
  <div id="user-address" style="word-break:break-all; font-size:0.9em; color:green; margin-bottom:1em;"></div>
  <canvas id="qr-code" style="margin:auto;"></canvas>

<div class="button-row">
  <button id="btn-confirm-wallet" onclick="(function(){
    document.querySelector('#section-wallet').innerHTML = mainMenu.items.wallet.html;
  })();">
    Done 
  </button>

  <button onclick="(function(){
    downloadPrivateKey.click()
  })();"> 
    Download/Save 
  </button>



</div>



</div>

    </div>

</div>`;

///////// Add a button to the above rendered div to trigger
//////// sectionWallet.innerHTML = mainMenu.items.wallet.html

document.querySelector('#section-wallet').innerHTML = mainMenu.items.wallet.final_html


  document.getElementById("user-address").textContent = account.address;

  new QRious({
    element: document.getElementById("qr-code"),
    value: account.address,
    size: 140,
    level: 'H'
  });
};

function handleMnemonicInput(e) {

if(typeof(e) == 'undefined')return;
  phrase = e.target.childNodes[0].innerText
  dgb.e = e

  if(phrase.length > 0)
     var output = e.target.children[0].textContent.split(" ");


  if (e.inputType == 'insertText') {
    output = e.target.textContent.split(" ");
    c(output.length)
    if (output.length >= 11) {
      console.log(output);
    }
  }

  if (e.inputType == 'insertFromPaste') {
    attempt = e.target.childNodes[0].innerText

    len = attempt.trim().split(" ").length

    if(len > 11)
       account=dgb.util.getMnemonicAddress(attempt)

    if(len == 1)
       {
       account = []
       account.address = dgb.util.privKey2Address(attempt).address
       account.wif = attempt
       }


    if(account)
        mainMenu.items.wallet.renderConfirmWallet('main')

    console.log(account);
  }
}

mainMenu.items.wallet.renderImportWallet = function(containerId = "main") {
  const container = document.getElementById(containerId);
  if (!container) return;

  mainMenu.items.wallet.created_html = `
  <div>
    <div id="mnemonic-box" contenteditable="true"
     style="margin-top:1em; padding:1em; border:1px solid #ccc; font-family:monospace; 
     min-height:4em; color:white; background-color:brown;">
    </div>
    <p style="font-size:0.9em; color:#b00; max-width:400px;">
      Paste your seed phrase above. This site will be able to then use your key until you reset the page or forget the key.
    </p>
  </div>`;

document.querySelector('#section-wallet').innerHTML = mainMenu.items.wallet.created_html
mainMenu.items.wallet.mnemonicBox = document.getElementById('mnemonic-box')

//// use this to get back
// document.querySelector(`#section-wallet`).innerHTML = mainMenu.tools.get("wallet").html

//  const box = document.getElementById("mnemonic-box");

mainMenu.items.wallet.mnemonicBox.addEventListener('input', handleMnemonicInput);

};

mainMenu.items.wallet.renderLoadWallet = function(containerId = "main") {
  const container = document.getElementById(containerId);
  if (!container) return;

let inp = document.createElement('input');
inp.type = 'file';
inp.accept = '.json';
inp.onchange = e => {
  let f = e.target.files[0];
  if (f) {
    let r = new FileReader();
    r.onload = () => {
      account  = JSON.parse(r.result);
      if(account)
        mainMenu.items.wallet.renderConfirmWallet('main')

    };
    r.readAsText(f);
  }
};
inp.click();
      
};

mainMenu.items.wallet.walletPopup = function walletPopup(topic) {
    const popup = document.createElement('div');

    popup.innerHTML = `<div id="user-id-box" style="border:1px solid #ccc; padding:1em; width:fit-content; text-align:center; font-family:sans-serif;">
  <div style="font-weight:bold; margin-bottom:0.5em;">${topic}</div>
  <div id="user-address" style="word-break:break-all; font-size:0.9em; color:green; margin-bottom:1em;"></div>
  <canvas id="qr-code-pop" style="margin:auto;"></canvas>
</div>`;


    popup.style.position = 'fixed';
    popup.style.top = '20%';
    popup.style.left = '30%';
    popup.style.background = '#111';
    popup.style.color = '#fff';
    popup.style.padding = '20px';
    popup.style.border = '1px solid #666';
    popup.style.zIndex = '9999';
    popup.style.cursor = 'pointer';
    popup.style.maxWidth = '80%';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';


  new QRious({
    element: document.getElementById("qr-code-pop"),
    value: account.address,
    size: 140,
    level: 'H'
  });

    popup.onclick = () => document.body.removeChild(popup);
    document.body.appendChild(popup);

};
