(function(g){
"use strict";
// Stable experimental initial symbol table for a NEW six-bit M64 dictionary.
// The source is a local JavaScript fixture, NOT a JSON ledger envelope.
// Primary symbols are byte sequences; secondary definitions are raw six-bit
// packed bytes with exact symbol counts. Do not silently rewrite any entry.
const primaryTerms=[
  " ",
  "%",
  "&",
  "(",
  ")",
  "*",
  "+",
  ",",
  "-",
  ".",
  "0",
  "1",
  "2",
  "3",
  "5",
  "6",
  "8",
  ":",
  ";",
  "<",
  "=",
  ">",
  "?",
  "A",
  "E",
  "L",
  "M",
  "R",
  "U",
  "[",
  "]",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "{",
  "|",
  "}",
  "p.",
  "=p.",
  "dy",
  "rr"
];
const secondaryDefinitions=[
  {
    "symbolCount": 9,
    "packedHex": "932ae1c67b2b00"
  },
  {
    "symbolCount": 16,
    "packedHex": "6338efd952820839c62c407a"
  },
  {
    "symbolCount": 15,
    "packedHex": "0e0ca41f41e61f5287d8a1c0"
  },
  {
    "symbolCount": 7,
    "packedHex": "ea68e7966c40"
  },
  {
    "symbolCount": 11,
    "packedHex": "2d62d120b4a98f1000"
  },
  {
    "symbolCount": 5,
    "packedHex": "1cc38f10"
  },
  {
    "symbolCount": 11,
    "packedHex": "6338efd94514284dc0"
  },
  {
    "symbolCount": 9,
    "packedHex": "69fc6625f8300c"
  },
  {
    "symbolCount": 6,
    "packedHex": "be3c72beb0"
  },
  {
    "symbolCount": 8,
    "packedHex": "1ef1e51e0137"
  },
  {
    "symbolCount": 6,
    "packedHex": "86caf0c400"
  },
  {
    "symbolCount": 6,
    "packedHex": "4a0ca47670"
  },
  {
    "symbolCount": 6,
    "packedHex": "eb49e2c660"
  },
  {
    "symbolCount": 5,
    "packedHex": "6e7966c4"
  },
  {
    "symbolCount": 4,
    "packedHex": "a63c40"
  },
  {
    "symbolCount": 6,
    "packedHex": "1378fd1940"
  },
  {
    "symbolCount": 5,
    "packedHex": "0e0ca41c"
  },
  {
    "symbolCount": 3,
    "packedHex": "9e40c0"
  },
  {
    "symbolCount": 4,
    "packedHex": "663931"
  },
  {
    "symbolCount": 5,
    "packedHex": "1ff0c41c"
  },
  {
    "symbolCount": 5,
    "packedHex": "fc51ea0c"
  },
  {
    "symbolCount": 5,
    "packedHex": "c29b2d8c"
  },
  {
    "symbolCount": 5,
    "packedHex": "86ca6cbc"
  },
  {
    "symbolCount": 4,
    "packedHex": "1bb8a2"
  }
];
function ascii(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++){let b=s.charCodeAt(i);if(b>127)throw Error("Non-ASCII seed");a[i]=b}return a}
function hex(s){if(!s||s.length%2||/[^a-fA-F0-9]/.test(s))throw Error("Invalid hex seed");return Uint8Array.from(s.match(/../g).map(v=>parseInt(v,16)))}
function create(){
 return {
  descriptor:{mediaType:"text/javascript",description:"Dark Star Z six-bit M64 experiment; reusable JS source fragments",codecVersion:2,dictionaryVersion:1},
  primary:primaryTerms.map(ascii),
  secondary:secondaryDefinitions.map(d=>({packed:hex(d.packedHex),symbolCount:d.symbolCount}))
 };
}
g.ChiselM64Native6DarkStarSeed=Object.freeze({create,primaryTerms:Object.freeze(primaryTerms),secondaryDefinitions:Object.freeze(secondaryDefinitions)});
})(globalThis);
