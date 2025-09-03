
canvases = []
tablets = []
tabs = []
canvi = []
colorMap0 = []

async function loadAll(b57file = "b57.json") {
      await Promise.all([
        fetch(b57file).then(res => res.json()).then(data => {
          data.forEach(entry => {
            const rgbArray = entry.rgb.split(',').map(v => parseInt(v.trim(), 10));
            colorMap0[entry.b57] = rgbArray;
          });
        })
      ]);
    }

loadAll();

async function loadAddressData( address, offset=0 ) {
    const url = `https://digiexplorer.info/api/address/${address}/txs?offset=${offset}`;
    const container = document.getElementById("section-address"); // replace with actual div id
    container.innerHTML = "Loading...";

    try {
        const res = await fetch(url);
        const txs = await res.json();
        dgb.txsCache = txs;

        // Find account amount (sum of UTXOs to address - spent)
        const balance = txs.reduce((bal, tx) => {
            c(tx.status.block_height)
            tx.vout.forEach(v => {
                if (v.scriptpubkey_address === address) {
                    bal += v.value;
                }
            });
            tx.vin.forEach(v => {
                if (v.prevout && v.prevout.scriptpubkey_address === address) {
                    bal -= v.prevout.value;
                }
            });
            return bal;
        }, 0);

        let html = `<div id="addressWidget"></div>
                    <pre id="results"></pre>
                    <div>Balance: ${balance / 1e8} DGB</div>`;
        html += `<table border="1" cellspacing="0" cellpadding="4">
                    <tr>
                        <th></th>
                        <th>Block</th>
                        <th>Date</th>
                        <th>OP_RETURN (ASCII)</th>
                    </tr>`;

        txs.forEach((tx, idx) => {
            const block = tx.status.block_height;
            const date = new Date(tx.status.block_time * 1000).toLocaleString();

            // Find OP_RETURN in vout
            let opReturnAscii = "";
            tx.vout.forEach(v => {
                if (v.scriptpubkey_type == "op_return") {
                
                    const hex = v.scriptpubkey_asm.split(" ")[2] || "";
                    opReturnAscii = hexToAscii(hex);
               //     console.log(hex);
                }
            });
    
            html += `<tr>

                        <td>
                          <button onclick="toggleDetails(${idx}, this)" style="background:white;border:none;cursor:pointer;">
                            <svg width="12" height="12" viewBox="0 0 12 12">
                                <line x1="1" y1="6" x2="11" y2="6" stroke="black" stroke-width="2"/>
                                <line x1="6" y1="1" x2="6" y2="11" stroke="black" stroke-width="2"/>
                            </svg>
                          </button>
                        </td>

                        <td>${block}</td>
                        <td>${date}</td>
                        <td>${opReturnAscii || ""}</td>
                    </tr>
                    <tr id="details-${idx}" style="display:none;">
                        <td colspan="5">

                    <div>
                       <button onclick="setDetailsView(${idx}, 'info')">Info</button>
                       <button onclick="setDetailsView(${idx}, 'raw')">Raw</button>
                       <div id="details-content-${idx}">

                           ${renderInfoView(tx)};
                         </div>
                       </div>

                      </td>
                    </tr>`;
        });

        html += `</table>`;
        container.innerHTML = `<h2>${address}</h2>` + html + "[more]";


new AddressCombo("#addressWidget", {
    addresses: [
      "DDDDDDDDDDDDDDDDDDDDDDDDDDDD5SVJPi",
      "DHooQkHNjos8X15qczAsA3s5cJEMGksdvj",
      "DBxYoUTUBEvCoMzzzzzzzzzzzzzzZ31xMU",
      "DBxYoUTUBEhCoMzzzzzzzzzzzzzzZkL3DC",
      "DBxVoCARoovCoMzzzzzzzzzzzzzzXL8bKa",
      "DBxVoCARoohCoMzzzzzzzzzzzzzzaAvVjE",
      "DATUGu64TCU4qD7vDC5hUYmyfRmEJcGM3J",
      "D6yKrBS6rrUD2Sp2G5TMPdTUY4pkMHGA6T",
      "DDbCsz8VeztP7AwmrWgNADAV58mWpDjqbw",
      "dgb1q4rdplx7k92y4llzq6v6qf9mgpr5zey2js49xzs",
      "DThvAmDxnSya4qnMzmmV2fCK8uCcYrHGFM",
      "DBx4CHANzzzzzzzzzzzzzzzzzzzzb1m2Ef",
      "DAzrL96Z61gP8FtXf1tyw5PteJfQs3fEb1",
      "DAxJoHNxRiGLERzzzzzzzzzzzzzzVKx51Q"
    ],
    onSearch: function(addr) {
        loadAddressData(addr)
      document.getElementById("results").innerHTML =
        "<h1>" + addr + "</h1>";
    }
  });

canvi.forEach( x =>  {
 canvas = document.getElementById(`canvas-${x}`)
 chisel.drawCharTabletImage(tabs.pop(),canvas);
})




    } catch (e) {
        container.innerHTML = "Error loading data";
        console.error(e);
    }
}

function renderInfoView(tx) {
    let html = "<strong>Inputs:</strong><br>";
    tx.vin.forEach(v => {
        if (v.prevout) {
            html += `${v.prevout.scriptpubkey_address || "unknown"}: ${v.prevout.value / 1e8} DGB<br>`;
        }
    });
    html += "<br><strong>Outputs:</strong><br>";
    html2 = ""

    tablet = []
   
    needCanvas = 0; 
    tx.vout.forEach(v => {
        value = v.value / 1e8;
        if(value == 0.0000546 && v.scriptpubkey_address.substr(0,2)=="SN" ) 
         {
          needCanvas = 1;
          tablet.push(v.scriptpubkey_address);
         }
        else
          html2 += `${v.scriptpubkey_address || "unknown"}: ${v.value / 1e8} DGB<br>`;
    });
    if(needCanvas)
         {
    
    tabs.push(tablet);
    canvi.push(tx.txid);
    html += `<canvas id=${"canvas-" + tx.txid}></canvas><br>`;
         }
    return "<pre>" + html + "</pre><hr>" + "<pre>" + html2 + "</pre>";
}

function setDetailsView(idx, mode) {
    const tx = dgb.txsCache[idx]; // We'll store tx data for reuse
    const container = document.getElementById(`details-content-${idx}`);
    if (mode === "info") {
        container.innerHTML = renderInfoView(tx);
    } else {
        container.innerHTML = `<pre>${JSON.stringify({vin: tx.vin, vout: tx.vout}, null, 2)}</pre>`;
    }
}

function toggleDetails(idx, btn) {
    const el = document.getElementById(`details-${idx}`);
    const isHidden = el.style.display === "none";

    el.style.display = isHidden ? "table-row" : "none";

    // Swap icon
    btn.innerHTML = isHidden
        ? `<svg width="12" height="12" viewBox="0 0 12 12">
               <line x1="1" y1="6" x2="11" y2="6" stroke="black" stroke-width="2"/>
           </svg>`
        : `<svg width="12" height="12" viewBox="0 0 12 12">
               <line x1="1" y1="6" x2="11" y2="6" stroke="black" stroke-width="2"/>
               <line x1="6" y1="1" x2="6" y2="11" stroke="black" stroke-width="2"/>
           </svg>`;
}


function hexToAscii(hex) {
    let str = "";
    for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
}
