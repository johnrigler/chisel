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

  function buildCall(ethersLib, deploymentId, functionName, args) {
    if (!ethersLib || typeof ethersLib.Interface !== "function") throw new Error("ethers ABI encoder is unavailable.");
    const info = descriptor(deploymentId);
    if (deploymentId !== "jethro.polygon.137" || functionName !== "mapArtifact") {
      throw new Error("Only Jethro mapArtifact writes are enabled in this version.");
    }
    if (!Array.isArray(args) || args.length !== 2 || args.some(value => typeof value !== "string")) {
      throw new Error("Jethro mapArtifact requires two strings.");
    }
    if (!args[0].length && !args[1].length) throw new Error("Enter an artifact or body.");
    const bytes = args.reduce((sum, value) => sum + new TextEncoder().encode(value).length, 0);
    if (bytes > 65536) throw new Error("Combined UTF-8 payload exceeds the 64 KiB safety limit.");
    const abi = new ethersLib.Interface(info.contractInterface.abi);
    const data = abi.encodeFunctionData(functionName, args);
    if (!/^0x[0-9a-f]+$/i.test(data) || data.length < 10 || data.length % 2 !== 0) {
      throw new Error("The ABI encoder did not produce valid calldata.");
    }
    return Object.freeze({
      deploymentId, chainId: info.deployment.chainId, to: info.deployment.address,
      interfaceId: info.contractInterface.id, implementationId: info.implementation.id,
      functionName, functionSignature: "mapArtifact(string,string)",
      artifact: args[0], body: args[1], byteLength: bytes, data,
      value: "0x0"
    });
  }

  root.CHISEL_EVM_CONTRACTS = Object.freeze({
    interfaces, implementations, deployments, descriptor, buildCall
  });
}(typeof window !== "undefined" ? window : globalThis));
