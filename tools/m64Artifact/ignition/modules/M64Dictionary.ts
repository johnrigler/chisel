import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const M64DictionaryModule = buildModule("M64DictionaryModule", (m) => {
  const dictionary = m.contract("M64Dictionary");
  return { dictionary };
});

export default M64DictionaryModule;
