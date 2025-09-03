(function () {
  // Hamburger button
  const hamburger = document.createElement('div');
  hamburger.innerHTML = '&#9776;';
  hamburger.style = `
    position: fixed;
    top: 10px;
    right: 10px;
    font-size: 24px;
    z-index: 9999;
    cursor: pointer;
    color: white;
    background: black;
    padding: 4px 10px;
    border-radius: 5px;
  `;

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.style = `
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    width: 300px;
    background-color: #111;
    color: white;
    padding: 20px;
    box-shadow: 2px 0 5px rgba(0,0,0,0.5);
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 9998;
    overflow-y: auto;
  `;

  // Toggle sidebar
  hamburger.onclick = () => {
    sidebar.style.transform =
      sidebar.style.transform === 'translateX(0%)'
        ? 'translateX(-100%)'
        : 'translateX(0%)';
  };
  sidebar.addEventListener('mouseleave', () => {
    sidebar.style.transform = 'translateX(-100%)';
  });

  // Sidebar content
  sidebar.innerHTML = `
    <h2>Mogwai</h2>

    <details>
      <summary>Home</summary>
      <ul style="list-style: none; padding-left: 10px;">
        <li><a href="#" style="color:white">Main View</a></li>
        <li><a href="#" style="color:white">Message View</a></li>
      </ul>
    </details>

    <details open>
      <summary>Config</summary>
      <ul style="list-style: none; padding-left: 10px;">
        <li id="proxySection"></li>
        <li style="margin-top: 10px;">
          <button id="downloadPrivateKey" style="width: 100%;">Download Private Key</button>
        </li>
      </ul>
    </details>
  `;

  const proxySection = sidebar.querySelector('#proxySection');

  // Helper: Test fileProxy server
  async function testFileProxy(url) {
    try {
      const res = await fetch(url + '/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirname: '' }),
      });
      if (!res.ok) throw new Error(res.status);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Render fileProxy UI
  function renderFileProxyUI(currentURL = 'http://localhost:7799') {
    proxySection.innerHTML = '<b>File Proxy:</b><br>';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentURL;
    input.style.width = '100%';

    const status = document.createElement('div');
    status.style.marginTop = '5px';
    status.style.fontSize = '0.9em';

    const button = document.createElement('button');
    button.textContent = 'Test Proxy';
    button.style.width = '100%';
    button.style.marginTop = '5px';

    button.onclick = async () => {
      status.textContent = 'Testing...';
      const ok = await testFileProxy(input.value);
      if (ok) {
        status.textContent = '✅ Proxy is running';
      } else {
        status.textContent = '❌ Proxy failed. Change URL or retry.';
      }
    };

    proxySection.appendChild(input);
    proxySection.appendChild(button);
    proxySection.appendChild(status);
  }

  // Render chisel_config.json UI
  function renderConfigUI() {
    const configDiv = document.createElement('div');
    configDiv.style.marginTop = '15px';
    configDiv.innerHTML = '<b>Fallback Config:</b>';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load chisel_config.json';
    loadBtn.style.width = '100%';
    loadBtn.style.marginTop = '5px';

    loadBtn.onclick = async () => {
      try {
        const res = await fetch('chisel_config.json');
        const cfg = await res.json();
        console.log('Config loaded:', cfg);
        alert('Config loaded. Check console.');
      } catch (e) {
        alert('Failed to load chisel_config.json');
      }
    };

    configDiv.appendChild(loadBtn);
    proxySection.appendChild(configDiv);
  }

  renderFileProxyUI();
  renderConfigUI();

  // Download Private Key
  sidebar.querySelector('#downloadPrivateKey').onclick = () => {
    if (!window.account) return alert('No account loaded.');
    const blob = new Blob([JSON.stringify(window.account)], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = window.account.address + '.json';
    a.click();
  };

  // Redirect home links to GitHub
  sidebar.querySelectorAll('a[href="#"]').forEach(a => {
    a.onclick = () => window.open('https://github.com/johnrigler/chisel', '_blank');
  });

// --- Add Save Config Button ---
const saveConfigBtn = document.createElement('button');
saveConfigBtn.textContent = 'Save Config File';
saveConfigBtn.style.width = '100%';
saveConfigBtn.style.marginTop = '10px';
proxySection.appendChild(saveConfigBtn);

// Popup helper
function showFileProxyTipModal(githubURL, callback) {
  // Check if user already opted out
  const skip = localStorage.getItem('skipFileProxyTip');
  if (skip === 'true') return callback(); // silently continue

  const modal = document.createElement('div');
  modal.style = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  const box = document.createElement('div');
  box.style = `
    background: #222;
    color: white;
    padding: 20px;
    border-radius: 8px;
    width: 320px;
    text-align: center;
  `;
  box.innerHTML = `
    <p>For automatic saving, install <b>fileProxy</b>.<br>
    <a href="${githubURL}" target="_blank" style="color: cyan;">Get it here</a></p>
    <label style="font-size: 0.9em;">
      <input type="checkbox" id="skipFileProxyTip"> Don't show this again
    </label><br><br>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'OK';
  closeBtn.style.width = '80px';
  closeBtn.onclick = () => {
    const skip = document.getElementById('skipFileProxyTip').checked;
    if (skip) localStorage.setItem('skipFileProxyTip', 'true');
    document.body.removeChild(modal);
    callback();
  };

  box.appendChild(closeBtn);
  modal.appendChild(box);
  document.body.appendChild(modal);
}

// Test fileProxy
async function fileProxyAvailable(url) {
  try {
    const res = await fetch(url + '/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirname: '' })
    });
    return res.ok;
  } catch {
    return false;
  }
}

saveConfigBtn.onclick = async () => {
  const fileProxyURL = document.querySelector('#fileProxyURL')?.value || "http://localhost:7799";
  const digibyteProxyURL = document.querySelector('#digibyteProxyURL')?.value || "http://localhost:7788";

  // Build config object
  const config = {
    version: "1.0.0",
    privateKeys: window.account ? [
      {
        name: window.account.address || "Main Account",
        path: "keys/" + (window.account.address || "account") + ".json",
        created: new Date().toISOString()
      }
    ] : [],
    recentProjects: [],
    proxies: {
      fileProxy: { url: fileProxyURL, enabled: true },
      digibyteProxy: { url: digibyteProxyURL, enabled: true }
    },
    settings: {
      autoLoadLastProject: true,
      defaultKey: window.account ? (window.account.address || "Main Account") : null,
      theme: "dark",
      showFileProxyTip: localStorage.getItem('skipFileProxyTip') !== 'true'
    }
  };

  const fileProxyRunning = await fileProxyAvailable(fileProxyURL);

  if (fileProxyRunning) {
    // Save via fileProxy
    try {
      await fetch(fileProxyURL + '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'chisel_config.json', data: config })
      });
      alert('Config saved via fileProxy');
    } catch (e) {
      alert('Error saving via fileProxy: ' + e.message);
    }
  } else {
    // Show tip first, then download browser version
    showFileProxyTipModal("https://github.com/johnrigler/fileProxy-node", () => {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = "chisel_config.json";
      a.click();
    });
  }
};


////////////////

// Add button to sidebar
proxySection.appendChild(saveConfigBtn);




  document.body.appendChild(hamburger);
  document.body.appendChild(sidebar);
})();

