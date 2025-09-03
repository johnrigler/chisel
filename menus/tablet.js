mainMenu.items.tablet.html = `
<section id="tablet" class="page" style="font-family:system-ui, sans-serif; color:#eee; background:#111; padding:12px; line-height:1.3;">
  <header style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
    <h2 style="margin:0; font-size:18px;">tablet</h2>
    <span style="opacity:.7">| account:</span>
    <code id="acctAddr" style="background:#222; padding:2px 6px; border-radius:6px;"></code>
    <button id="btnFetchUtxo" style="margin-left:auto; background:#2a2a2a; border:1px solid #444; color:#eee; padding:4px 8px; border-radius:8px; cursor:pointer;">Fetch UTXOs</button>
  </header>
  <div style="display:grid; gap:10px;">
    <!-- BEFORE -->
    <div style="background:#1a1a1a; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <strong>before</strong>
        <button data-role="add-before" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:3px 7px; border-radius:8px; cursor:pointer;">+ insert</button>
      </div>
      <ol id="listBefore" style="margin:0; padding-left:18px;"></ol>
    </div>

    <!-- TABLET (main lines[]) -->
    <div style="background:#1a1a1a; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <strong>tablet</strong>
        <button data-role="add-main" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:3px 7px; border-radius:8px; cursor:pointer;">+ insert</button>
      </div>
      <ol id="listMain" style="margin:0; padding-left:18px; font-family: monospace; font-size: 16px;"></ol>

    </div>

    <!-- AFTER -->
    <div style="background:#1a1a1a; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <strong>after</strong>
        <button data-role="add-after" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:3px 7px; border-radius:8px; cursor:pointer;">+ insert</button>
      </div>
      <ol id="listAfter" style="margin:0; padding-left:18px;"></ol>
    </div>

    <!-- UTXO + TX BUILDER -->
    <div style="background:#0f0f0f; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <strong>inputs (UTXO) → vin</strong>
        <span style="opacity:.7">(select)</span>
      </div>
      <div id="utxoArea" style="overflow:auto; border:1px solid #222; border-radius:8px; max-height:200px;"></div>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button id="btnBuildVin" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:4px 8px; border-radius:8px; cursor:pointer;">Build vin</button>
        <button id="btnClearUtxoSel" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:4px 8px; border-radius:8px; cursor:pointer;">Clear</button>
      </div>
    </div>

    <div style="background:#0f0f0f; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <strong>outputs (from tablet) → vout</strong>
        <span style="opacity:.7">(you’ll wire MacDougall → addr/value)</span>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:6px;">
        <button id="btnBuildVout" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:4px 8px; border-radius:8px; cursor:pointer;">Build vout</button>
        <button id="btnAddOpReturn" style="background:#2a2a2a; border:1px solid #444; color:#eee; padding:4px 8px; border-radius:8px; cursor:pointer;">+ OP_RETURN</button>
      </div>
      <textarea id="txVout" rows="6" spellcheck="false" style="width:100%; background:#111; color:#ddd; border:1px solid #333; border-radius:8px; padding:8px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;"></textarea>
    </div>

    <div style="background:#0f0f0f; border:1px solid #333; border-radius:10px; padding:10px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <strong>createrawtransaction args</strong>
      </div>
      <label style="display:block; margin-bottom:6px; opacity:.8;">vin</label>
      <textarea id="txVin" rows="6" spellcheck="false" style="width:100%; background:#111; color:#ddd; border:1px solid #333; border-radius:8px; padding:8px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;"></textarea>
      <label style="display:block; margin:10px 0 6px 0; opacity:.8;">vout</label>
      <textarea id="txVoutMirror" rows="6" spellcheck="false" style="width:100%; background:#111; color:#ddd; border:1px solid #333; border-radius:8px; padding:8px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;"></textarea>
    </div>
  </div>
</section>`;

/* call: tabletInit(container, { lines, account, fetchUTXOs }) */

(function(){
  function el(q, r){ return (r||document).querySelector(q); }
  function makeLineLi(val, arr, idx, onChange){
    const li = document.createElement('li');
    li.style.margin = '2px 0';
    li.style.display = 'flex';
    li.style.gap = '6px';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = val || '';
    inp.spellcheck = false;
    inp.style.flex = '1';
    inp.style.background = '#151515';
    inp.style.color = '#ddd';
    inp.style.border = '1px solid #333';
    inp.style.borderRadius = '6px';
    inp.style.padding = '4px 6px';
    inp.style.fontFamily = 'monospace';
    inp.style.fontSize = '16px';
    inp.oninput = function()
        { 
        arr[idx] = inp.value; 
      //  onChange && onChange();
        };
    const del = document.createElement('button');
    del.textContent = '−';
    del.title = 'delete line';
    del.style.background = '#2a2a2a';
    del.style.border = '1px solid #444';
    del.style.color = '#eee';
    del.style.padding = '0 8px';
    del.style.borderRadius = '6px';
    del.style.cursor = 'pointer';
    del.onclick = function()
        { 
        arr.splice(idx,1); 
        onChange && onChange();
        };
    li.appendChild(inp); li.appendChild(del);
    return li;
  }

  function renderList(ol, arr, onChange){
    ol.innerHTML = '';
    arr.forEach((v,i)=> ol.appendChild(makeLineLi(v, arr, i, onChange)));
  }

  function defaultTransformToVout(pre, main, post){

    // Placeholder. You will replace with MacDougall → addr/value mapping + change.
    // Example shape:
    // return { "DxxBurnAddrXXXX": 0.0001, "DDx...": 0.0002, "OP_RETURN": "6a20..." }
    let mainJ = main.map((line, i) => ({ [line]:0.0000547 }));
    let postJ = post.map((line, i) => ({ [line]:0.095}));
    const all = [].concat(pre, mainJ, postJ);
    dgb.all = all
//    const all = [].concat(pre, mainJ, post).filter(s=>s && s.trim().length);
 //   dgb.all = mainJ;
    return JSON.stringify(all);
//    return { "__replace_me__example_address__": 0.00010000, "__lines_count__": all.length };
  }

  function defaultFetchUTXOsFallback(){
    const raw = prompt('Paste UTXO JSON array (each item with txid, vout, value, scriptPubKey, confirmations):', '[]');
    try { return Promise.resolve(JSON.parse(raw||'[]')); } catch(e){ return Promise.resolve([]); }
  }

  function utxoTable(utxos, selected){
    const wrap = document.createElement('div');
    const tbl = document.createElement('table');
    tbl.style.width='100%'; tbl.style.borderCollapse='collapse'; tbl.style.fontSize='12px';
    const head = document.createElement('thead');
    head.innerHTML = '<tr>' +
      '<th style="text-align:left; border-bottom:1px solid #333; padding:4px;">sel</th>' +
      '<th style="text-align:left; border-bottom:1px solid #333; padding:4px;">txid</th>' +
      '<th style="text-align:right; border-bottom:1px solid #333; padding:4px;">vout</th>' +
      '<th style="text-align:right; border-bottom:1px solid #333; padding:4px;">value</th>' +
      '<th style="text-align:left; border-bottom:1px solid #333; padding:4px;">scriptPubKey</th>' +
    '</tr>';
    const body = document.createElement('tbody');
    utxos.forEach((u, i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="padding:4px; border-bottom:1px solid #222;"></td>' +
        '<td style="padding:4px; border-bottom:1px solid #222; font-family:ui-monospace;">'+ (u.txid||'') +'</td>' +
        '<td style="padding:4px; border-bottom:1px solid #222; text-align:right;">'+ (u.vout??'') +'</td>' +
        '<td style="padding:4px; border-bottom:1px solid #222; text-align:right; font-family:ui-monospace;">'+ (u.value??'') +'</td>' +
        '<td style="padding:4px; border-bottom:1px solid #222; font-family:ui-monospace; overflow-wrap:anywhere;">'+ (u.scriptPubKey||'') +'</td>';
      const td0 = tr.children[0];
      const cb = document.createElement('input'); cb.type='checkbox';
      cb.checked = !!selected.has(i);
      cb.onchange = ()=>{ if(cb.checked) selected.add(i); else selected.delete(i); };
      td0.appendChild(cb);
      body.appendChild(tr);
    });
    tbl.appendChild(head); tbl.appendChild(body); wrap.appendChild(tbl); return wrap;
  }

  window.tabletInit = function(root, state){
    state = state || {};
    const pre = state.beforeLines || [];
    const main = state.lines || [];
    const post = state.afterLines || [];
    const acct = (state.account && state.account.address) || '';
    const fetchUTXOs = state.fetchUTXOs || defaultFetchUTXOsFallback;
    const acctAddr = root.querySelector('#acctAddr');
    const listBefore = root.querySelector('#listBefore');
    const listMain   = root.querySelector('#listMain');
    const listAfter  = root.querySelector('#listAfter');
    const utxoArea   = root.querySelector('#utxoArea');
    const btnFetch   = root.querySelector('#btnFetchUtxo');
    const btnBuildVin = root.querySelector('#btnBuildVin');
    const btnClearSel = root.querySelector('#btnClearUtxoSel');
    const btnBuildVout = root.querySelector('#btnBuildVout');
    const btnAddOpRet = root.querySelector('#btnAddOpReturn');
    const txVin = root.querySelector('#txVin');
    const txVout = root.querySelector('#txVout');
    const txVoutMirror = root.querySelector('#txVoutMirror');

    acctAddr.textContent = acct || '(no account)';

    function rerender(){
      renderList(listBefore, pre, rerender);
      renderList(listMain,   main, rerender);
      renderList(listAfter,  post, rerender);
    }
    rerender();

    root.addEventListener('click', function(ev){
      const role = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-role');
      if(!role) return;
      if(role === 'add-before'){ pre.push(''); rerender(); }
      if(role === 'add-main'){   main.push(''); rerender(); }
      if(role === 'add-after'){  post.push(''); rerender(); }
    });

  //  let utxos = [];
    const selectedIdx = new Set();

    btnFetch.onclick = async function(){
    //  utxos = await fetchUTXOs(acct);
      // utxos = utxo;
      selectedIdx.clear();
      utxoArea.innerHTML = '';
      utxoArea.appendChild(utxoTable(utxo, selectedIdx));
    };

    btnClearSel.onclick = function(){
      selectedIdx.clear();
      utxoArea.innerHTML = '';
      utxoArea.appendChild(utxoTable(utxo, selectedIdx));
      txVin.value = '';
    };

    btnBuildVin.onclick = function(){
      const vin = [];
      selectedIdx.forEach(i=>{
        const u = utxo[i];
        if(u && u.txid != null && u.vout != null){
          vin.push({ txid: u.txid, vout: u.vout });
        }
      });
      txVin.value = JSON.stringify(vin, null, 2);
    };

    btnBuildVout.onclick = function(){
      //// jar
      const voutObj = (state.transformToVout || defaultTransformToVout)(pre, main, post);
      dgb.voutObj = voutObj
      const pretty = JSON.stringify(voutObj, null, 2);
      txVout.value = pretty;
      txVoutMirror.value = pretty;
    };

    btnAddOpRet.onclick = function(){
      try{
        const curr = txVout.value.trim() ? JSON.parse(txVout.value) : {};
        const hex = prompt('1 OP_RETURN hex (no 0x, e.g., "6a200102...")', '');
        if(hex && hex.length){
          curr['data'] = hex;
          const pretty = JSON.stringify(curr, null, 2);
          txVout.value = pretty;
          txVoutMirror.value = pretty;
        }
      }catch(e){
        alert('Invalid vout JSON. Build vout first.');
      }
    };

    // Optional helpers exposed for your code
    state.api = {
      getBefore: ()=> pre.slice(),
      getMain:   ()=> main.slice(),
      getAfter:  ()=> post.slice(),
      setBefore: (arr)=>{ pre.splice(0, pre.length, ...(arr||[])); rerender(); },
      setMain:   (arr)=>{ main.splice(0, main.length, ...(arr||[])); rerender(); },
      setAfter:  (arr)=>{ post.splice(0, post.length, ...(arr||[])); rerender(); },
      getSelectedUtxos: ()=> Array.from(selectedIdx).map(i=>utxos[i]),
      setVout: (obj)=>{ const s = JSON.stringify(obj||{}, null, 2); txVout.value = s; txVoutMirror.value = s; },
      setVin:  (arr)=>{ txVin.value = JSON.stringify(arr||[], null, 2); },
    };

    btnFetch.click();
    return state.api;
  };
})();

