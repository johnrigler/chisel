import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const code = await Promise.all([
  "chisel.evm.contracts.js", "chisel.evm.write.js", "chisel.evm.write.ui.js"
].map(name => readFile(new URL("../" + name, import.meta.url), "utf8")));
const ZERO = "0x" + "0".repeat(40);
const ACCOUNT = "0x" + "12".repeat(20);
const HASH = "0x" + "af".repeat(32);

class Element {
  constructor(id) {
    this.id = id;
    this.value = "";
    this.disabled = /(?:SendBtn|ReceiptBtn)$/.test(id);
    this.textContent = "";
    this.children = [];
    this.handlers = new Map();
    this.hidden = true;
  }
  addEventListener(name, callback) { this.handlers.set(name, callback); }
  replaceChildren(...children) {
    this.children = [...children];
    this.value = children[0]?.value || "";
  }
  async fire(name) {
    const callback = this.handlers.get(name);
    assert.equal(typeof callback, "function", this.id + " " + name + " registered");
    return callback.call(this, {target: this});
  }
}

function fixture() {
  const nodes = new Map();
  const suffixes = ["WriteStatus","Interface","Deployment","ContractLink","Wallet","WalletStatus",
    "RefreshWalletsBtn","ConnectBtn","SwitchChainBtn","ReviewBtn","SendBtn","ReceiptBtn",
    "Review","TxLink"];
  for (const prefix of ["gomez","jethro"]) {
    for (const suffix of suffixes) nodes.set(prefix+suffix,new Element(prefix+suffix));
  }
  for (const suffix of ["Artifact","Body"]) nodes.set("jethro"+suffix,new Element("jethro"+suffix));
  nodes.set("gomezMessage",new Element("gomezMessage"));
  for (let i=1;i<=4;i++) {
    const receiver=new Element("gomezReceiver"+i);
    receiver.value=ZERO;
    nodes.set(receiver.id,receiver);
    const amount=new Element("gomezAmount"+i);
    amount.value="0";
    nodes.set(amount.id,amount);
  }
  const calls = [], listeners = new Map(), providerEvents = new Map();
  let failure = "", chain = "0x89", account = ACCOUNT;
  const provider = {
    on(name,callback) { providerEvents.set(name,callback); },
    async request({method,params}) {
      calls.push({method,params});
      if(method==="eth_requestAccounts"||method==="eth_accounts")return [account];
      if(method==="eth_chainId")return chain;
      if(method==="eth_getCode")return "0x6000";
      if(method==="eth_call") {
        if(failure) throw new Error(failure);
        return "0x";
      }
      if(method==="eth_estimateGas")return "0x40000";
      if(method==="eth_sendTransaction")return HASH;
      if(method==="eth_getTransactionReceipt")return null;
      if(method==="wallet_switchEthereumChain"){ chain=params[0].chainId; return null; }
      throw new Error("Unexpected provider method: "+method);
    }
  };
  const document = {
    getElementById(id) {
      assert.ok(nodes.has(id),"Required EVM control exists: "+id);
      return nodes.get(id);
    },
    createElement(tag) { return new Element(tag); }
  };
  const context=vm.createContext({
    document, TextEncoder, console, Event:class { constructor(type){this.type=type;} },
    ethereum:provider,
    addEventListener(name,callback){listeners.set(name,callback);},
    dispatchEvent(event){ listeners.get(event.type)?.(event); },
    ethers:{
      getAddress(address){return address;},
      keccak256(code){return "hash:"+code;},
      Interface:class {
        constructor(abi){ assert.ok(abi.some(line=>line.startsWith("function "))); }
        encodeFunctionData(fn,args) {
          return (fn==="tell"?"0x87654321":"0x12345678")+
            Buffer.from(JSON.stringify(args.map(v=>typeof v==="bigint"?v.toString():v))).toString("hex");
        }
      }
    }
  });
  context.window=context;
  for(const source of code)vm.runInContext(source,context);
  return {context,nodes,calls,provider,providerEvents,
    get:id=>nodes.get(id),setFailure:value=>{failure=value;},
    setAccount:value=>{account=value;},setChain:value=>{chain=value;}};
}

test("both EVM write panels mount using one wallet discovery and separate reviewed calls", async () => {
  const f=fixture();
  assert.equal(f.get("gomezWallet").value,"injected");
  assert.equal(f.get("jethroWallet").value,"injected");

  f.get("gomezMessage").value="DGB and Polygon";
  f.get("gomezReceiver1").value="0x"+"34".repeat(20);
  f.get("gomezAmount1").value="16";

  await f.get("gomezConnectBtn").fire("click");
  await f.get("gomezReviewBtn").fire("click");
  assert.equal(f.get("gomezSendBtn").disabled,false);
  assert.equal(f.get("jethroSendBtn").disabled,true);
  const g=JSON.parse(f.get("gomezReview").textContent);
  assert.equal(g.function,"tell(string,address,uint256,address,uint256,address,uint256,address,uint256)");
  assert.equal(g.message,"DGB and Polygon");
  assert.equal(g.amounts[0],"16");
  assert.equal(g.receivers[0],"0x"+"34".repeat(20));
  assert.equal(g.nativeValueWei,"0");
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);
  await f.get("gomezSendBtn").fire("click");
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,1);
  assert.equal(f.calls.find(x=>x.method==="eth_sendTransaction").params[0].to,
    f.context.CHISEL_EVM_CONTRACTS.deployments["gomez.polygon.137"].address);
  assert.equal(f.get("gomezReceiptBtn").disabled,false);

  f.get("jethroArtifact").value="chisel";
  f.get("jethroBody").value="https://johnrigler.github.io/chisel";
  await f.get("jethroConnectBtn").fire("click");
  await f.get("jethroReviewBtn").fire("click");
  assert.equal(f.get("jethroSendBtn").disabled,false);
  const j=JSON.parse(f.get("jethroReview").textContent);
  assert.equal(j.function,"mapArtifact(string,string)");
  assert.equal(j.artifact,"chisel");
  assert.equal(j.body,"https://johnrigler.github.io/chisel");
  assert.equal(j.contract,f.context.CHISEL_EVM_CONTRACTS.deployments["jethro.polygon.137"].address);

  f.providerEvents.get("accountsChanged")(["0x"+"ff".repeat(20)]);
  assert.equal(f.get("jethroSendBtn").disabled,true);
  assert.equal(f.get("gomezSendBtn").disabled,true);
  assert.match(f.get("jethroWriteStatus").textContent,/Reconnect/);
});

test("Gomez owner-only revert displays the error and does not permit a send", async () => {
  const f=fixture();
  f.get("gomezMessage").value="Testing permission";
  await f.get("gomezConnectBtn").fire("click");
  f.setFailure('execution reverted: "Only the contract owner can run this"');
  await f.get("gomezReviewBtn").fire("click");
  assert.equal(f.get("gomezSendBtn").disabled,true);
  assert.match(f.get("gomezWriteStatus").textContent,/Only the contract owner/);
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);
});

test("editing Gomez fields invalidates approved calldata", async () => {
  const f=fixture();
  f.get("gomezMessage").value="Original";
  await f.get("gomezConnectBtn").fire("click");
  await f.get("gomezReviewBtn").fire("click");
  assert.equal(f.get("gomezSendBtn").disabled,false);
  f.get("gomezMessage").value="Edited";
  await f.get("gomezMessage").fire("input");
  assert.equal(f.get("gomezSendBtn").disabled,true);
  assert.equal(f.get("gomezReview").textContent,"No reviewed calldata.");
});
