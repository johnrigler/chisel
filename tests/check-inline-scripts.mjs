import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const files=process.argv.slice(2);
if(!files.length)throw new Error('usage: node tests/check-inline-scripts.mjs <html>...');

for(const file of files){
  const html=await readFile(file,'utf8');
  const re=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match,index=0,checked=0;
  while((match=re.exec(html))){
    index++;
    const tag=match[0].slice(0,match[0].indexOf('>')+1);
    if(/\bsrc\s*=/.test(tag))continue;
    const code=match[1].trim();
    if(!code)continue;
    new vm.Script(code,{filename:`${file}:inline-script-${index}`});
    checked++;
  }
  if(!checked)throw new Error(`${file}: no inline scripts checked`);
  console.log(`${file}: ${checked} inline script(s) parsed`);
}
