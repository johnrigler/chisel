(function(root){
  "use strict";
  const entries=new Map();
  function register(id,descriptor){
    if(!id || !descriptor || !descriptor.workspace || !Array.isArray(descriptor.formats)) throw new Error("Invalid Send workspace");
    entries.set(id,Object.freeze({...descriptor,id,formats:Object.freeze(descriptor.formats.map(f=>Object.freeze({...f})))}));
  }
  function get(id){
    if(entries.has(id)) return entries.get(id);
    const coin=root.CHISEL.coins[id];
    if(!coin) return null;
    const formats=coin.CAN_SEND===false?[]:[{id:"payment",label:"Payment",state:"available"},{id:"op_return",label:"OP_RETURN",state:"available"}];
    if(coin.CAN_SEND!==false && coin.UNSPENDABLE_MODIFIERS) formats.push({id:"unspendable",label:"Readable addresses",state:"available"});
    if(coin.SUPPORTS_IPFS_FIELD) formats.push({id:"ipfs",label:"IPFS field",state:"available"});
    return {id,label:coin.DISPLAY_NAME,workspace:"utxo",formats,canBroadcast:coin.CAN_SEND!==false};
  }
  function list(){return [...root.CHISEL.getCoins().map(c=>get(c.NAME)),...Array.from(entries.values()).filter(e=>!root.CHISEL.coins[e.id])];}
  function href(id){if(!get(id)) throw new Error("Unknown Send network");return id==="polygon"?"?mode=send&coin=evm&chain=137":"?mode=send&coin="+encodeURIComponent(id);}
  register("polygon",{label:"Polygon (POL)",workspace:"polygon",canBroadcast:true,formats:[{id:"chisel",label:"Chisel contract",state:"available"}]});
  root.CHISEL_SEND=Object.freeze({register,get,list,href});
})(window);
