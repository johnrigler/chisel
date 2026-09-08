(function(g){
"use strict";
const M=g.ChiselM64;
if(!M)throw new Error("m64.javascript.js requires m64.js first");

const ID="js-canonical-v1";
const CONTROL_PAREN=new Set(["if","while","for","with","switch","catch"]);
const PREFIX_KEYWORDS=new Set(["return","throw","case","delete","typeof","void","new","in","instanceof","yield","await","else","do","extends"]);
const VALUE_KEYWORDS=new Set(["this","super","true","false","null"]);

function identifierStart(c){return !!c&&/[A-Za-z_$]/.test(c)}
function identifierPart(c){return !!c&&/[A-Za-z0-9_$]/.test(c)}
function digit(c){return !!c&&/[0-9]/.test(c)}

function skipQuoted(src,start,quote){
  let i=start+1,esc=false;
  for(;i<src.length;i++){
    const c=src[i];
    if(esc){esc=false;continue}
    if(c==="\\"){esc=true;continue}
    if(c===quote)return i+1;
    if(c==="\n"||c==="\r")throw new Error("js-canonical-v1 rejects unterminated string literals");
  }
  throw new Error("js-canonical-v1 rejects unterminated string literals");
}

function skipLineComment(src,start){
  let i=start+2;
  while(i<src.length&&src[i]!=="\n"&&src[i]!=="\r")i++;
  return i;
}

function skipBlockComment(src,start){
  const end=src.indexOf("*/",start+2);
  if(end<0)throw new Error("js-canonical-v1 rejects unterminated block comments");
  return end+2;
}

function inspectJavascriptV1(src){
  src=String(src??"");
  const parens=[];
  let i=0,canEndExpression=false,pendingControlParen=false;

  while(i<src.length){
    const c=src[i],n=src[i+1];

    if(/\s/.test(c)){i++;continue}

    if(c==="`")throw new Error("js-canonical-v1 rejects template literals");

    if(c==="'"||c==='"'){
      i=skipQuoted(src,i,c);
      canEndExpression=true;
      pendingControlParen=false;
      continue;
    }

    if(c==="/"&&n==="/"){
      i=skipLineComment(src,i);
      continue;
    }

    if(c==="/"&&n==="*"){
      i=skipBlockComment(src,i);
      continue;
    }

    if(c==="/"){
      if(!canEndExpression)throw new Error("js-canonical-v1 rejects regular-expression literals or ambiguous '/' syntax");
      i+=n==="="?2:1;
      canEndExpression=false;
      pendingControlParen=false;
      continue;
    }

    if(identifierStart(c)){
      let j=i+1;
      while(j<src.length&&identifierPart(src[j]))j++;
      const word=src.slice(i,j);
      pendingControlParen=CONTROL_PAREN.has(word);
      if(pendingControlParen||PREFIX_KEYWORDS.has(word))canEndExpression=false;
      else canEndExpression=true;
      if(VALUE_KEYWORDS.has(word))canEndExpression=true;
      i=j;
      continue;
    }

    if(digit(c)||(c==="."&&digit(n))){
      let j=i+1;
      while(j<src.length&&/[A-Za-z0-9._]/.test(src[j]))j++;
      i=j;
      canEndExpression=true;
      pendingControlParen=false;
      continue;
    }

    if(c==="("){
      parens.push(pendingControlParen?"control":"normal");
      pendingControlParen=false;
      canEndExpression=false;
      i++;
      continue;
    }

    if(c===")"){
      const kind=parens.pop()||"normal";
      canEndExpression=kind!=="control";
      pendingControlParen=false;
      i++;
      continue;
    }

    if(c==="]"){
      canEndExpression=true;
      pendingControlParen=false;
      i++;
      continue;
    }

    if(c==="}"){
      // A closing brace can end either an object expression or a statement block.
      // Treat it as ambiguous so a following slash is rejected rather than
      // accidentally canonicalizing a regular-expression literal as code.
      canEndExpression=false;
      pendingControlParen=false;
      i++;
      continue;
    }

    if((c==="+"&&n==="+")||(c==="-"&&n==="-")){
      i+=2;
      pendingControlParen=false;
      // Postfix ++/-- can end an expression; prefix forms cannot.
      canEndExpression=canEndExpression;
      continue;
    }

    if(c==="["||c==="{"||c===","||c===";"||c===":"||c==="?"||c==="="||c==="+"||c==="-"||c==="*"||c==="%"||c==="&"||c==="|"||c==="^"||c==="!"||c==="~"||c==="<"||c===">"){
      canEndExpression=false;
      pendingControlParen=false;
      i++;
      continue;
    }

    // Dot/property access and other punctuation do not create a safe regex
    // boundary. Keeping canEndExpression false is conservative for v1.
    canEndExpression=false;
    pendingControlParen=false;
    i++;
  }

  if(parens.length)throw new Error("js-canonical-v1 rejects unbalanced parentheses");
  return{canonicalizer:ID,safe:true};
}

function canonicalizeJavascriptV1(src,map){
  inspectJavascriptV1(src);
  return M.canonicalize(src,map);
}

M.JS_CANONICAL_V1=Object.freeze({id:ID});
M.inspectJavascriptV1=inspectJavascriptV1;
M.canonicalizeJavascriptV1=canonicalizeJavascriptV1;
})(globalThis);
