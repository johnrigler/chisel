mainMenu.items.welcome.html = `

<section style="text-align:center; padding:1.5em; margin:auto;">
  <div style="display:flex; gap:10px; align-items:center; justify-content:center;">
    
    <div style="width:250px; height:250px; display:flex; align-items:center; justify-content:center;">
      <img src="mogwaiOrig.png" alt="Original"
           style="max-width:100%; max-height:100%; object-fit:contain;">
    </div>

    <div style="width:80px; height:80px; display:flex; align-items:center; justify-content:center;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 20"
           style="width:80%; height:auto;">
        <rect x="0" y="6" width="22" height="8" fill="white" />
        <polygon points="22,0 36,10 22,20" fill="white" />
      </svg>
    </div>

    <div style="width:250px; height:250px; display:flex; align-items:center; justify-content:center;">
      <img src="mogwaiPixel.png" alt="Chisel demo"
           style="max-width:100%; max-height:100%; object-fit:contain;">
    </div>

   <div style="width:80px; height:80px; display:flex; align-items:center; justify-content:center;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 20"
           style="width:80%; height:auto;">
        <rect x="0" y="6" width="22" height="8" fill="white" />
        <polygon points="22,0 36,10 22,20" fill="white" />
      </svg>
    </div>

    <div style="width:250px; height:250px; display:flex; align-items:center; justify-content:center;">
      <img src="mogwaiLedger.png" alt="Chisel demo"
           style="max-width:100%; max-height:100%; object-fit:contain;">
    </div>

  </div>
</section>

<section style="text-align:center; padding:1.5em; max-width:300px; margin:auto;">


  <p style="font-size:1.1em; line-height:1.4;">
    Create Blockchain Images and Messages on the Digibyte network.  
    Tap into the power of the forever Web.
  </p>

   <button
     style="display:inline-block; margin-top:1em; padding:0.6em 1.2em; 
            background:#0074D9; color:white; border:none; border-radius:6px; 
            font-weight:bold; cursor:pointer;" onclick="document.getElementById('btn-wallet').click()">
     Go to Wallet
   </button>

</section>
    `;
