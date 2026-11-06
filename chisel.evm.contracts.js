(function (root) {
  "use strict";

  // Interface, implementation and deployment are deliberately distinct.
  // A Solidity implementation can expose several interfaces, and one
  // implementation can have multiple deployments.
  const interfaces = Object.freeze({
    "gomez.tell.v1": Object.freeze({
      id: "gomez.tell.v1",
      title: "Gomez tell",
      abi: Object.freeze([
        "function tell(string message,address receiver1,uint256 amount1,address receiver2,uint256 amount2,address receiver3,uint256 amount3,address receiver4,uint256 amount4)"
      ])
    }),
    "jethro.mapArtifact.v1": Object.freeze({
      id: "jethro.mapArtifact.v1",
      title: "Jethro mapArtifact",
      abi: Object.freeze(["function mapArtifact(string artifact,string body)"])
    }),
    "chisel.v1": Object.freeze({
      id: "chisel.v1",
      title: "Mogwai / Chisel v1",
      abi: Object.freeze([
        "function creator() view returns (address)",
        "function mapArtifact(string artifact,string body)",
        "function getArtifact(address writer,string artifact) view returns (string body,uint64 revision)",
        "function logRecord(bytes32 format,bytes data)",
        "function distribute((address recipient,uint256 amount)[] payments) payable",
        "function distributeChecked((address recipient,uint256 amount)[] payments) payable",
        "function execute(string artifact,string body,(address recipient,uint256 amount)[] payments,bytes32 logFormat,bytes logData) payable",
        "function pendingRefunds(address writer) view returns (uint256)",
        "function withdrawRefund()",
        "event ArtifactMapped(address indexed writer,bytes32 indexed artifactKeyHash,uint64 revision,string artifact,string body)",
        "event RecordLogged(address indexed writer,bytes32 indexed format,bytes data)",
        "event TransferResult(address indexed writer,address indexed recipient,uint256 indexed index,uint256 amount,uint8 status)",
        "event RefundCredited(address indexed writer,uint256 amount)",
        "event RefundWithdrawn(address indexed writer,uint256 amount)"
      ])
    })
  });

  // These are references, not assertions that the deployed Solidity has
  // been independently recovered or its bytecode verified by Chisel.
  const implementations = Object.freeze({
    "gomez.legacy.v1": Object.freeze({
      id: "gomez.legacy.v1", language: "Solidity",
      interfaceId: "gomez.tell.v1", source: null, runtimeBytecodeHash: null
    }),
    "jethro.legacy.v1": Object.freeze({
      id: "jethro.legacy.v1", language: "Solidity",
      interfaceId: "jethro.mapArtifact.v1", source: null, runtimeBytecodeHash: null
    }),
    "chisel.v1": Object.freeze({
      id: "chisel.v1", language: "Solidity",
      interfaceId: "chisel.v1", source: "contracts/Chisel.sol",
      compiledArtifact: "contracts/compiled/Chisel.json", runtimeBytecodeHash: null
    })
  });

  const deployments = Object.freeze({
    "gomez.polygon.137": Object.freeze({
      id: "gomez.polygon.137", name: "Gomez", chainId: 137,
      address: "0x5a2220d56f56db9C9F5B0cb83ff35b42746503a2",
      implementationId: "gomez.legacy.v1", interfaceId: "gomez.tell.v1"
    }),
    "jethro.polygon.137": Object.freeze({
      id: "jethro.polygon.137", name: "Jethro", chainId: 137,
      address: "0x0076416C84c7151CaEfA74C3e09d6eBF2f296BA0",
      implementationId: "jethro.legacy.v1", interfaceId: "jethro.mapArtifact.v1"
    }),
    "chisel.polygon.137": Object.freeze({
      id: "chisel.polygon.137", name: "Mogwai / Chisel", chainId: 137,
      address: "0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3",
      deploymentTxHash: "0x5b398b46531cdc47eaed8cc3f28d2079f42d154effdd6c72712c51ea5e83a02d",
      implementationId: "chisel.v1", interfaceId: "chisel.v1",
      verificationStatus: "address-provided-by-deployer"
    })
  });

  function descriptor(deploymentId) {
    const deployment = deployments[deploymentId];
    if (!deployment) throw new Error("Unknown contract deployment.");
    const implementation = implementations[deployment.implementationId];
    const contractInterface = interfaces[deployment.interfaceId];
    if (!implementation || !contractInterface || implementation.interfaceId !== contractInterface.id) {
      throw new Error("Inconsistent contract registry.");
    }
    return {deployment, implementation, contractInterface};
  }

  const ZERO_ADDRESS = "0x" + "00".repeat(20);
  const UINT256_MAX = (1n << 256n) - 1n;
  const GOMEZ_SIGNATURE = "tell(string,address,uint256,address,uint256,address,uint256,address,uint256)";

  // Keep writing restricted to specifically configured contracts/functions.
  // The full ABI may contain additional methods, but that does not make all
  // those methods safe for generic UI generation.
  function buildCall(ethersLib, deploymentId, functionName, args) {
    if (!ethersLib || typeof ethersLib.Interface !== "function") throw new Error("ethers ABI encoder is unavailable.");
    const info = descriptor(deploymentId);
    let details;
    if (deploymentId === "jethro.polygon.137" && functionName === "mapArtifact") {
      if (!Array.isArray(args) || args.length !== 2 || args.some(value => typeof value !== "string")) {
        throw new Error("Jethro mapArtifact requires two strings.");
      }
      if (!args[0].length && !args[1].length) throw new Error("Enter an artifact or body.");
      const bytes = args.reduce((sum, value) => sum + new TextEncoder().encode(value).length, 0);
      if (bytes > 65536) throw new Error("Combined UTF-8 payload exceeds the 64 KiB safety limit.");
      details = {
        abiArgs: args, functionSignature: "mapArtifact(string,string)",
        artifact: args[0], body: args[1], byteLength: bytes
      };
    } else if (deploymentId === "gomez.polygon.137" && functionName === "tell") {
      if (!Array.isArray(args) || args.length !== 9 || typeof args[0] !== "string") {
        throw new Error("Gomez tell requires a message and four address/amount pairs.");
      }
      const message = args[0];
      if (!message.length) throw new Error("Enter a Gomez message.");
      const bytes = new TextEncoder().encode(message).length;
      if (bytes > 65536) throw new Error("Gomez message exceeds the 64 KiB safety limit.");
      const receivers = [], amounts = [], abiArgs = [message];
      for (let i = 0; i < 4; i += 1) {
        const receiver = args[1 + i * 2];
        const amount = args[2 + i * 2];
        if (typeof receiver !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(receiver)) {
          throw new Error("Gomez receiver " + (i + 1) + " must be a 20-byte EVM address.");
        }
        if (typeof ethersLib.getAddress !== "function") throw new Error("ethers address validation is unavailable.");
        let checked;
        try { checked = ethersLib.getAddress(receiver); }
        catch (_) { throw new Error("Gomez receiver " + (i + 1) + " has an invalid EVM checksum."); }
        if (typeof amount !== "string" || !/^(0|[1-9][0-9]*)$/.test(amount)) {
          throw new Error("Gomez amount " + (i + 1) + " must be an unsigned decimal uint256 integer (raw units).");
        }
        const integer = BigInt(amount);
        if (integer > UINT256_MAX) throw new Error("Gomez amount " + (i + 1) + " exceeds uint256.");
        if (checked.toLowerCase() === ZERO_ADDRESS && integer !== 0n) {
          throw new Error("Gomez amount " + (i + 1) + " must be zero when receiver " + (i + 1) + " is the zero address.");
        }
        receivers.push(checked);
        amounts.push(amount);
        abiArgs.push(checked, integer);
      }
      details = {
        abiArgs, functionSignature: GOMEZ_SIGNATURE,
        message, receivers, amounts, byteLength: bytes
      };
    } else if (deploymentId === "chisel.polygon.137") {
      const client = root.CHISEL_EVM_CHISEL;
      const allowed = ["mapArtifact", "logRecord", "execute", "distribute", "distributeChecked", "withdrawRefund"];
      if (!allowed.includes(functionName)) throw new Error("Chisel function is not enabled for writing.");
      if (!client || typeof client.prepare !== "function") throw new Error("Chisel browser adapter is not loaded.");
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        throw new Error("Chisel write arguments must be a parameter object.");
      }
      const artifact = args.artifact === undefined ? "" : args.artifact;
      const body = args.body === undefined ? "" : args.body;
      if (typeof artifact !== "string" || typeof body !== "string") throw new Error("Chisel artifact and body must be text.");
      const byteLength = new TextEncoder().encode(artifact).length + new TextEncoder().encode(body).length;
      if (byteLength > 65536) throw new Error("Chisel artifact and body exceed the 64 KiB safety limit.");
      if (functionName === "mapArtifact" && !artifact.length) throw new Error("Enter a Chisel artifact key.");
      const logFormat = args.logFormat === undefined ? client.ZERO_FORMAT : args.logFormat;
      const logData = args.logData === undefined ? "0x" : args.logData;
      if (functionName === "logRecord" && logData === "0x") throw new Error("Enter nonempty Chisel log data.");
      if (typeof logData !== "string" || logData.length > 131074) {
        throw new Error("Chisel log data exceeds the 64 KiB safety limit.");
      }
      const payable = ["execute", "distribute", "distributeChecked"].includes(functionName);
      const inputPayments = payable ? (args.payments === undefined ? [] : args.payments) : [];
      if (!Array.isArray(inputPayments) || inputPayments.length > 32) {
        throw new Error("Chisel supports at most 32 payments per reviewed transaction.");
      }
      const normalizedPayments = inputPayments.map(function (payment, index) {
        if (!payment || typeof payment !== "object" || typeof payment.recipient !== "string") {
          throw new Error("Payment " + (index + 1) + " requires an EVM recipient.");
        }
        let recipient;
        try { recipient = ethersLib.getAddress(payment.recipient); }
        catch (_) { throw new Error("Payment " + (index + 1) + " has an invalid EVM address/checksum."); }
        if (recipient.toLowerCase() === ZERO_ADDRESS) {
          throw new Error("Payment " + (index + 1) + " cannot target the zero address.");
        }
        const amountWei = payment.amountWei === undefined ? payment.amount : payment.amountWei;
        if (typeof amountWei !== "string" || !/^(0|[1-9][0-9]*)$/.test(amountWei)) {
          throw new Error("Payment " + (index + 1) + " must have a decimal integer amount in wei.");
        }
        const amount = BigInt(amountWei);
        if (amount === 0n || amount > UINT256_MAX) {
          throw new Error("Payment " + (index + 1) + " amount must be between 1 and uint256 maximum.");
        }
        return {recipient, amountWei};
      });
      if ((functionName === "distribute" || functionName === "distributeChecked") && !normalizedPayments.length) {
        throw new Error("Enter at least one Chisel payment.");
      }
      const total = normalizedPayments.reduce(function (sum, payment) { return sum + BigInt(payment.amountWei); }, 0n);
      if (total > UINT256_MAX) throw new Error("Payment total exceeds uint256.");
      if (args.valueWei !== undefined && (typeof args.valueWei !== "string" ||
          !/^(0|[1-9][0-9]*)$/.test(args.valueWei) || BigInt(args.valueWei) !== total)) {
        throw new Error("Native wei value must exactly equal the sum of payments.");
      }
      if (functionName === "execute" && !artifact.length && logData === "0x" && !normalizedPayments.length) {
        throw new Error("Chisel execute requires an artifact, log, or payment.");
      }
      const prepared = client.prepare(functionName, {
        artifact, body, logFormat, logData, payments: normalizedPayments, valueWei: total.toString()
      });
      const functionSignatures = {
        mapArtifact: "mapArtifact(string,string)",
        logRecord: "logRecord(bytes32,bytes)",
        execute: "execute(string,string,(address,uint256)[],bytes32,bytes)",
        distribute: "distribute((address,uint256)[])",
        distributeChecked: "distributeChecked((address,uint256)[])",
        withdrawRefund: "withdrawRefund()"
      };
      details = {
        abiArgs: prepared.args, functionSignature: functionSignatures[functionName],
        artifact: ["mapArtifact", "execute"].includes(functionName) ? artifact : undefined,
        body: ["mapArtifact", "execute"].includes(functionName) ? body : undefined,
        logFormat: ["logRecord", "execute"].includes(functionName) ? logFormat : undefined,
        logData: ["logRecord", "execute"].includes(functionName) ? logData : undefined,
        payments: prepared.payments.map(function (payment) {
          return {recipient: payment.recipient, amountWei: payment.amount.toString()};
        }),
        paymentTotalWei: prepared.paymentTotalWei.toString(),
        nativeValueWei: prepared.valueWei.toString(),
        byteLength, value: prepared.value
      };
    } else {
      throw new Error("The requested contract function is not enabled for writing.");
    }
    const abi = new ethersLib.Interface(info.contractInterface.abi);
    const data = abi.encodeFunctionData(functionName, details.abiArgs);
    if (!/^0x[0-9a-f]+$/i.test(data) || data.length < 10 || data.length % 2 !== 0) {
      throw new Error("The ABI encoder did not produce valid calldata.");
    }
    const {abiArgs, ...publicDetails} = details;
    return Object.freeze({
      deploymentId, chainId: info.deployment.chainId, to: info.deployment.address,
      interfaceId: info.contractInterface.id, implementationId: info.implementation.id,
      functionName, ...publicDetails, data, value: details.value || "0x0"
    });
  }

  root.CHISEL_EVM_CONTRACTS = Object.freeze({
    interfaces, implementations, deployments, descriptor, buildCall
  });
}(typeof window !== "undefined" ? window : globalThis));
