import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const code = await Promise.all([
  "chisel.evm.contracts.js", "chisel.evm.chisel.js", "chisel.evm.write.js", "chisel.evm.write.ui.js"
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
  appendChild(child) {
    this.children.push(child);
    if (this.children.length === 1) this.value = child.value || "";
    return child;
  }
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
  for (const prefix of ["gomez","jethro","chisel"]) {
    for (const suffix of suffixes) nodes.set(prefix+suffix,new Element(prefix+suffix));
  }
  for (const suffix of ["Artifact","Body"]) nodes.set("jethro"+suffix,new Element("jethro"+suffix));
  nodes.set("gomezMessage",new Element("gomezMessage"));
  for (const suffix of ["Method","Artifact","Body","LogFormat","LogData","Payments"]) {
    nodes.set("chisel"+suffix,new Element("chisel"+suffix));
  }
  nodes.get("chiselMethod").value="mapArtifact";
  nodes.get("chiselLogFormat").value="0x"+"0".repeat(64);
  nodes.get("chiselLogData").value="0x";
  for (const id of ["chiselDictionaryFields","chiselLogFields","chiselPaymentsFields","chiselValuePreview"]) {
    nodes.set(id,new Element(id));
  }
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
            Buffer.from(JSON.stringify(args,(_key,v)=>typeof v==="bigint"?v.toString():v)).toString("hex");
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

test("Chisel wallet writer renders, reviews and changes methods without sending", async () => {
  const f=fixture();
  assert.equal(f.get("chiselWallet").value,"injected");
  assert.equal(f.get("chiselDictionaryFields").hidden,false);
  assert.equal(f.get("chiselLogFields").hidden,true);
  f.get("chiselArtifact").value="SB Shell";
  f.get("chiselBody").value="Signed artifact";
  await f.get("chiselConnectBtn").fire("click");
  await f.get("chiselReviewBtn").fire("click");
  assert.equal(f.get("chiselSendBtn").disabled,false);
  const mapped=JSON.parse(f.get("chiselReview").textContent);
  assert.equal(mapped.function,"mapArtifact(string,string)");
  assert.equal(mapped.nativeValueWei,"0");
  assert.equal(mapped.contract,"0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3");
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);

  f.get("chiselMethod").value="logRecord";
  await f.get("chiselMethod").fire("change");
  assert.equal(f.get("chiselSendBtn").disabled,true,"method switch invalidates review");
  assert.equal(f.get("chiselLogFields").hidden,false);
  assert.equal(f.get("chiselDictionaryFields").hidden,true);
  f.get("chiselLogData").value="0x68656c6c6f";
  await f.get("chiselReviewBtn").fire("click");
  assert.equal(JSON.parse(f.get("chiselReview").textContent).function,"logRecord(bytes32,bytes)");
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);

  f.get("chiselMethod").value="distributeChecked";
  await f.get("chiselMethod").fire("change");
  f.get("chiselPayments").value="0x"+"34".repeat(20)+",11\n0x"+"56".repeat(20)+",19";
  await f.get("chiselPayments").fire("input");
  assert.match(f.get("chiselValuePreview").textContent,/30 wei/);
  await f.get("chiselReviewBtn").fire("click");
  const paymentReview=JSON.parse(f.get("chiselReview").textContent);
  assert.equal(paymentReview.nativeValueWei,"30");
  assert.equal(paymentReview.paymentTotalWei,"30");
  assert.equal(paymentReview.function,"distributeChecked((address,uint256)[])");
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);
  await f.get("chiselSendBtn").fire("click");
  const sends=f.calls.filter(x=>x.method==="eth_sendTransaction");
  assert.equal(sends.length,1);
  assert.equal(sends[0].params[0].value,"0x1e");
  assert.equal(sends[0].params[0].to,paymentReview.contract);
  assert.equal(f.get("chiselReceiptBtn").disabled,false);
});

test("Chisel invalid amounts fail before simulation and sending", async () => {
  const f=fixture();
  await f.get("chiselConnectBtn").fire("click");
  f.get("chiselMethod").value="distribute";
  await f.get("chiselMethod").fire("change");
  f.get("chiselPayments").value="0x"+"12".repeat(20)+",1e18";
  await f.get("chiselReviewBtn").fire("click");
  assert.equal(f.get("chiselSendBtn").disabled,true);
  assert.match(f.get("chiselWriteStatus").textContent,/decimal integer|decimal wei/);
  assert.equal(f.calls.filter(x=>x.method==="eth_sendTransaction").length,0);
});
