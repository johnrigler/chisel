import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  // Hardhat 3 disallows sources outside its project root. The npm scripts
  // stage an ignored byte-for-byte copy of the canonical root source here.
  paths: { sources: "./contracts" },
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.30",
    settings: {
      metadata: {
        appendCBOR: false,
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    polygon: {
      type: "http",
      chainType: "l1",
      chainId: 137,
      url: configVariable("POLYGON_RPC_URL"),
      accounts: [configVariable("POLYGON_PRIVATE_KEY")],
    },
  },
});
