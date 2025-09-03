<!DOCTYPE html>
<script src="chisel.js?234"></script>
<script src="colorpicker.js?23434"></script>
<html>
<head>
  <meta charset="UTF-8">
  <title>Base58 Tablet Doodler v2</title>

<script>

    if (typeof ux === "undefined") {
      var ux = [];
    }

//  fetch("colorPicker.js").then( x => x.text()).then(eval)


  const Base58Color = {
    base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    getColorMap: () => {
      const map = {
        // Named colors (52) + emergency color 'z'
        '1': [255, 000, 000], '2': [000, 128, 000], '3': [000, 000, 255], '4': [255, 255, 000],
        '5': [255, 165, 000], '6': [165, 042, 042], '7': [255, 192, 203], '8': [000, 255, 255],
        '9': [255, 105, 180], 'A': [000, 128, 128], 'B': [255, 215, 000], 'C': [139, 069, 019],
        'D': [173, 216, 230], 'E': [124, 252, 000], 'F': [240, 230, 140], 'G': [255, 020, 147],
        'H': [000, 191, 255], 'J': [186, 085, 211], 'K': [112, 128, 144], 'L': [255, 228, 196],
        'M': [210, 105, 030], 'N': [070, 130, 180], 'P': [128, 000, 128], 'Q': [100, 149, 237],
        'R': [000, 100, 000], 'S': [072, 061, 139], 'T': [255, 069, 000], 'U': [047, 079, 079],
        'V': [189, 183, 107], 'W': [199, 021, 133], 'X': [000, 139, 139], 'Y': [233, 150, 122],
        'Z': [153, 050, 204], 'a': [255, 140, 000], 'b': [034, 139, 034], 'c': [123, 104, 238],
        'd': [250, 128, 114], 'e': [255, 160, 122], 'f': [095, 158, 160], 'g': [255, 099, 071],
        'h': [218, 112, 214], 'i': [154, 205, 050], 'j': [147, 112, 219], 'k': [106, 090, 205],
        'm': [060, 179, 113], 'n': [176, 196, 222], 'o': [111,111,111], 'p': [000, 206, 209], 'q': [238, 130, 238],
        'r': [205, 092, 092], 's': [244, 164, 096],
        'z': [255, 000, 255], // emergency/escape/transparent
        // Grayscale (t–y)
        't': [000, 000, 000],        // black
        'u': [051, 051, 051],     // dark gray
        'v': [102, 102, 102],  // medium-dark
        'w': [153, 153, 153],  // medium-light
        'x': [204, 204, 204],  // light gray
        'y': [255, 255, 255]   // white

      };
      return map;
    }
  };
</script>


  <style>
    body {
      background: #111;
      color: #eee;
      font-family: monospace;
      padding: 20px;
    }
    #tablet {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: flex;
      gap: 1px;
    }
    .pixel {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }
    .gray {
      filter: grayscale(1);
      opacity: 0.6;
      cursor: default;
    }
    #output {
      margin-top: 20px;
      white-space: pre-wrap;
    }
    #picker {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 2px;
      margin-top: 10px;
      max-width: 200px;
    }
    .swatch {
      width: 14px;
      height: 14px;
      cursor: pointer;
      border: 1px solid #444;
    }
    .selected {
      border: 2px solid white;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 2px;
      margin-bottom: 10px;
    }

  </style>
</head>
<body>

<h2>🪨 Base58 Tablet Doodler v2</h2>
<button onclick="addLine()">Add Line</button>
<button onclick="exportTablet()">Save</button>
<button onclick="loadExample()">Load Example</button>
<div id="tablet"></div>
<pre id="output"></pre>

<script>
const base58 = Base58Color.base58.split('');
const colorMap = Base58Color.getColorMap(120);
const tabletEl = document.getElementById('tablet');
const outputEl = document.getElementById('output');
const pickerEl = document.getElementById('color-picker');
const grayEl   = document.getElementById('gray');
const ROW_LENGTH = 34;
const PREFIX_LENGTH = 2;
const CHECKSUM_LENGTH = 6;
const BODY_LENGTH = 26;
let currentChar = base58[0];
let isMouseDown = false;

function paintCell(cell) {
  cell.style.backgroundColor = "black";
  console.log(selected,cell)
 if(selected)
  cell.dataset.char = currentChar
  cell.style.backgroundColor = selected.style.backgroundColor;
}

function addLine(prefix = '1A', body = null) {
  const row = document.createElement('div');
  row.className = 'row';
  const line = [];

  for (let i = 0; i < ROW_LENGTH; i++) {
    const div = document.createElement('div');
    div.className = 'pixel';

    if (i < PREFIX_LENGTH) {
      const char = prefix[i] || '1';
      div.dataset.char = char;
      div.classList.add('gray');
      console.log()
    //  RGB="#" + b58Colors.find(x => x.b57 === currentChar).rgb
      div.style.backgroundColor = "blue"

    } else if (i >= ROW_LENGTH - CHECKSUM_LENGTH) {
      const char = 'z';
      div.dataset.char = char;
      div.classList.add('gray');
   //   RGB="#" + b58Colors.find(x => x.b57 === currentChar).rgb
      div.style.backgroundColor = "green"

    } else {
      const char = body ? body[i - PREFIX_LENGTH] : base58[0];
      div.dataset.char = char;
      div.onmousedown = () => paintCell(div);
      div.onmouseover = (e) => { if (isMouseDown) paintCell(div); };
   //   div.style.backgroundColor = `rgb(${colorMap[char].join(',')})`;

    //  RGB="#" + b58Colors.find(x => x.b57 === currentChar).rgb
      div.style.backgroundColor = "white"
   if(selected)
      div.style.backgroundColor = selected.style.backgroundColor



    }
    row.appendChild(div);
    line.push(div);
  }
  row.line = line;
  tabletEl.appendChild(row);
}
/////////////

function exportTablet() {
  const lines = [];
  for (const row of tabletEl.children) {
    const line = Array.from(row.children).map(cell => cell.dataset.char).join('');
    lines.push(line);
  }
  outputEl.textContent = lines.join('\n');
}

function loadExample() {
  tabletEl.innerHTML = '';
  const example = [

    'SS11111111111111111111111111zzzzzz',
    'SS11111111111111111111111111zzzzzz',
    'SS11111111111111111111111111zzzzzz',
    'SS11Spppppp99999999S11111111zzzzzz',
    'SS11SpppSAAAAAAAAAAS11111111zzzzzz',
    'SS11SppAAAAQAAAAAAAS11111111zzzzzz',
    'SS1SpAAAAAAQQQAAAAAAS1111111zzzzzz',
    'SS1SpASSSSSFFQQQQAAAS1111111zzzzzz',
    'SS1SSS1111SAFFFFAAAAS1111111zzzzzz',
    'SS11111111SAAFSSFFAAAS111111zzzzzz',
    'SS111111111SAFS1SFFAAS111111zzzzzz',
    'SS1111111111SSS11SFAAS111111zzzzzz',
    'SS1111111111111111SAAS111111zzzzzz',
    'SS11111111111111111SAS111111zzzzzz',
    'SS11111111111111111SAS111111zzzzzz',
    'SS1111111111111111SFAAS11111zzzzzz',
    'SS11111111111111SSFFAAASS111zzzzzz',
    'SS1111111111111SFFFFSAAApS11zzzzzz',
    'SS111111111111SFFFSS1SSpppS1zzzzzz',
    'SS111111111111SSSS11111SSSS1zzzzzz'

  ];
  for (const line of example) {
    const prefix = line.slice(0, 2);
    const body = line.slice(2, 2 + BODY_LENGTH);
    addLine(prefix, body);
  }
}

function updateSelectedSwatch() {
  for (const swatch of pickerEl.children) {
    swatch.classList.toggle('selected', swatch.dataset.char === currentChar);
  }
}

document.body.onmousedown = () => isMouseDown = true;
document.body.onmouseup = () => isMouseDown = false;

//initPicker();
updateSelectedSwatch();
for (let i = 0; i < 6; i++) addLine();
</script>

</body>
</html>
