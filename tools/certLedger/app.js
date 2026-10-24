(() => {
    'use strict';
    const C=ChiselCertLedger, $=id=>document.getElementById(id);
    function review() {
        $('load-send').disabled=true; $('payload').textContent='Not prepared.';
        try {
            const hash=C.digest($('sha256').value.trim());
            const payload=C.payload(hash,$('tag-amount').value.trim());
            $('payload').textContent=payload.opReturnAscii;
            $('cost').textContent='2 unspendable tag outputs × '+$('tag-amount').value.trim()+' LTC, plus the network fee selected in Send.';
            $('status').textContent='Hash-only draft ready. Load it into Send to review funding, outputs and fees.';
            $('load-send').disabled=false;
        } catch(error) { $('status').textContent=error.message; }
    }
    $('sha256').addEventListener('input',review); $('tag-amount').addEventListener('input',review);
    $('draft-file').addEventListener('change',async()=>{
        try {
            const file=$('draft-file').files[0]; if(!file)return;
            if(file.size>16384)throw new Error('Choose the small hash-only Chisel draft, not a PDF or private pair record.');
            $('sha256').value=C.fromDraft(JSON.parse(await file.text())); review();
        } catch(error){$('load-send').disabled=true;$('status').textContent=error.message;}
    });
    $('load-send').addEventListener('click',()=>{
        try {
            const payload=C.payload($('sha256').value.trim(),$('tag-amount').value.trim());
            sessionStorage.setItem(C.STORAGE_KEY,JSON.stringify(payload));
            location.href='../../index.html?mode=send';
        } catch(error){$('status').textContent='Could not open Send: '+error.message;}
    });
    const query=new URLSearchParams(location.hash.slice(1));
    if(query.has('sha256'))$('sha256').value=query.get('sha256');
    review();
})();
