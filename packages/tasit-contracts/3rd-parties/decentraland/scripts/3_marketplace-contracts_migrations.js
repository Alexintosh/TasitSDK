const Marketplace = artifacts.require("./Marketplace.sol");
const TasitContracts = require("../../../../dist/TasitContracts")
  .TasitContracts;

// Note: If you want to change this file, make sure that you are editing
// the original file inside of the `tasit-contracts/3rd-parties/decentraland/scripts`
module.exports = (deployer, network, accounts) => {
  [owner] = accounts;
  const { local } = TasitContracts;
  const { MANAToken, EstateRegistry } = local;
  const { address: MANA_ADDRESS } = MANAToken;
  const { address: ESTATE_ADDRESS } = EstateRegistry;

  // Workaround to write async/await migration scripts
  // See more: https://github.com/trufflesuite/truffle/issues/501#issuecomment-332589663
  deployer.then(async () => {
    const marketplace = await deployer.deploy(Marketplace);
    await marketplace.initialize(MANA_ADDRESS, ESTATE_ADDRESS, owner);
  });
};
