window.chiselMenu = [
  {
    id: "welcome",
    label: "Welcome",
    html: "Loading VINs..."
  },
  {
    id: "demo",
    label: "Demonstration",
    html: ""
  },
  {
    id: "images",
    label: "SN Images",
    html: "<div id='snImages'></div>"
  },
  {
    id: "import",
    label: "Import Image",
    html: `<input type="file" accept="image/png" onchange="importImage(event)" />
           <img id="preview" style="max-width:100%; margin-top:1em;" />`
  },
  {
    id: "draw",
    label: "Draw",
    html: `<canvas id="drawCanvas" width="256" height="256"></canvas>
           <button onclick="clearCanvas()">Clear</button>`
  },
  {
    id: "wallet",
    label: "Create/Import/Export your wallet",
    html: "",
    alt: []
  },
  {
    id: "save",
    label: "Save/Load",
    html: `<button onclick="saveToFile()">Save</button>
           <input type="file" onchange="loadFromFile(event)" />`
  },
  {
    id: "help",
    label: "Help",
    html: `<button onclick="helpWithApi()">Help API</button>
           <input type="file" onchange="helpWithApi(event)" />`,
    submenu: [
      {
        title: "About",
        action: () => showHelp("about")
      },
      {
        title: "Demo",
        action: () => showHelp("demo")
      },
      {
        title: "Config",
        action: () => showHelp("config")
      }
    ]
  }
];

idx = x => chiselMenu.findIndex(obj => obj.id === x);
