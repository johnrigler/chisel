import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={};
vm.runInNewContext(await readFile(new URL('../chisel.portal.view.js',import.meta.url),'utf8'),{window});
const shouldOpen=window.CHISEL_PORTAL_VIEW.shouldOpenRecordRow;
const click=(extra={},control=false)=>({button:0,target:{nodeType:1,closest:()=>control?{}:null},...extra});
const doc={getSelection:()=>({isCollapsed:true})};
test('record header opens except nested controls, modified clicks and text selection',()=>{
 assert.equal(shouldOpen(click(),doc),true);
 assert.equal(shouldOpen(click({},true),doc),false);
 for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}])assert.equal(shouldOpen(click(extra),doc),false);
 assert.equal(shouldOpen(click(),{getSelection:()=>({isCollapsed:false,toString:()=>'text'})}),false);
});
