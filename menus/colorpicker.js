
    if (typeof ux === "undefined") {
      var ux = [];
    }

    let selected = null;

    currentChar = "x";

    b58Colors = []

    ux.b58Colors = b58Colors;

    pickMap = [ 
       1, 5, 4, 3, 6, 7, 8, 9,10,
      11,20,13,14,15,17,18,19,24,
      23,22,21,12,25,26,27,28,30,29,
      31,32,33,34,35,36,37,38,39,44,
      41,42,43,40,45,46,47,48,49,
      51,52,53,55,54,56,50,16,2,0

  ]

 function rgb(rgbString) {
    const parts = rgbString.split(',').map(x => parseInt(x.trim(), 10));
    if (parts.length !== 3 || parts.some(n => isNaN(n) || n < 0 || n > 255)) {
        throw new Error("Invalid RGB input");
    }
    return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}



//    fetch("b58w.json").then( x => x.json() ).then( x => b58Colors = x)

    function createColorPicker() {
      const container = document.createElement('div');
      container.className = 'color-picker';

      pickMap.forEach( (pick,pos) => {
        const box = document.createElement('div');
        color = b58Colors[pick];
 //       console.log(color.rgb);
        RGB = rgb(color.rgb)
        box.className = 'color-box';
        box.style.backgroundColor = RGB

        box.addEventListener('click', () => {
          if (selected) selected.classList.remove('selected');
          box.classList.add('selected');
          selected = box;
          currentChar = b58Colors[pick].b57;
          ux.currentChar = currentChar;
          document.getElementById('selectedColor').textContent = `Selected: "${b58Colors[pick].b57}" ${b58Colors[pick].name}`;
        });

        container.appendChild(box);
      });

      document.body.appendChild(container);

      const result = document.createElement('div');
      result.id = 'selectedColor';
      result.textContent = 'Selected: None';
      document.body.appendChild(result);
    }

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    body {
      font-family: sans-serif;
      padding: 20px;
    }
    .color-picker {
      display: grid;
      grid-template-columns: repeat(10, 25px);
      gap: 6px;
    }
    .color-box {
      width: 20px;
      height: 20px;
      border: 1px solid transparent;
      cursor: pointer;
      box-shadow: 0 0 2px rgba(0,0,0,0.2);
    }
    .color-box.selected {
      border: 1px solid black;
    }
    #selectedColor {
      margin-top: 20px;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}


    async function init() {
      injectStyles();
      try {
        const response = await fetch("b57.json");
        b58Colors = await response.json();
        createColorPicker(); // only runs after fetch is complete
      } catch (err) {
      console.error("Failed to load color map:", err);
      }
    }

init();

