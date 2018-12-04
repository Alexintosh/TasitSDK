"use strict";

var _chai = require("chai");

var _ethers = require("ethers");

const waitForEvent = async (eventName, expected) => {
  return new Promise(function (resolve, reject) {
    contract.on(eventName, function () {
      const args = Array.prototype.slice.call(arguments);
      const event = args.pop();
      event.removeListener();
      (0, _chai.expect)(args, `${event.event} event should have expected args`).to.deep.equal(expected);
      resolve();
    });
  });
};

const ropstenProvider = _ethers.ethers.getDefaultProvider("ropsten");

const zero = _ethers.ethers.utils.bigNumberify(0);

let wallet, randomWallet, contract;
let rawTx = {
  nonce: 0,
  gasLimit: 21000,
  gasPrice: _ethers.ethers.utils.bigNumberify("20000000000"),
  to: "0x88a5C2d9919e46F883EB62F7b8Dd9d0CC45bc290",
  value: _ethers.ethers.utils.parseEther("0.0000001"),
  data: "0x",
  chainId: _ethers.ethers.utils.getNetwork("ropsten").chainId
};
describe("ethers.js - pretests", function () {
  it("should create a wallet from priv key and provider", async function () {
    const privateKey = "0x18bfdd05c1e63e4a27081352e2910c164a4d34588f8d7eecfdfcb654742934c2";
    wallet = new _ethers.ethers.Wallet(privateKey, ropstenProvider);
    (0, _chai.expect)(wallet.address).to.have.lengthOf(42);
    (0, _chai.expect)(wallet.provider).to.be.not.undefined;
  });
  it("should create a random wallet ", async function () {
    randomWallet = _ethers.ethers.Wallet.createRandom();
    (0, _chai.expect)(randomWallet.address).to.have.lengthOf(42);
  });
  it("should get balance of wallet", async function () {
    randomWallet = randomWallet.connect(ropstenProvider);

    const fundedWalletBalance = _ethers.ethers.utils.bigNumberify((await wallet.getBalance()));

    const emptyWalletBalance = _ethers.ethers.utils.bigNumberify((await randomWallet.getBalance()));

    (0, _chai.expect)(fundedWalletBalance).not.to.be.undefined;
    (0, _chai.assert)(emptyWalletBalance.eq(zero));
  });
}); // Note: We're intentionally not testing the `fromEncryptedJson` or `encrypt` functions
// from `ethers.js` because we don't plan to expose that functionality in the Tasit SDK.
// For a detailed explanation of why, see this GitHub issue:
// https://github.com/tasitlabs/TasitSDK/issues/24#issuecomment-443576993

describe("ethers.js - unit tests", function () {
  before("wallet used to sign transactions should have funds", async () => {
    const balance = _ethers.ethers.utils.bigNumberify((await wallet.getBalance()));

    (0, _chai.assert)(balance.gt(zero), "wallet balance is zero");
  });
  it("should sign a raw transaction", async function () {
    const signedTx = await wallet.sign(rawTx);
    const expectedSignedTx = "0xf869808504a817c8008252089488a5c2d9919e46f883eb62f7b8dd9d0cc45bc29085" + "174876e8008029a00ea09864b0757df77c4fddd91ab4cb585a1c56dd433de363ca98cd" + "1eebe0a9aca05804e85eebc1de8d0c1de189ce2dafe94ed197565723a3b335c90d3f73" + "62eb7b";
    (0, _chai.expect)(signedTx).to.equal(expectedSignedTx);
  });
  it("should sign a message", async function () {
    const rawMsg = "Hello World!";
    const signedMsg = await wallet.signMessage(rawMsg);
    const expectedSignedMsg = "0xcdd313d56ac1945e799a8c9d28d971fe40231ab354178611fbfe9b5ec00f493a4e33" + "2781e2e72c1978b0d5540ff9fb667c54dc5c0792d9cf9b0ec10485da0d021b";
    (0, _chai.expect)(signedMsg).to.be.equals(expectedSignedMsg);
  });
  it("should sign a binary message", async function () {
    // The 66 character hex string MUST be converted to a 32-byte array first!
    const hash = "0x3ea2f1d0abf3fc66cf29eebb70cbd4e7fe762ef8a09bcc06c8edf641230afec0";

    const binData = _ethers.ethers.utils.arrayify(hash);

    const expectedSignedBinData = "0x4d6e6ed24078bbdb3e2d45a01276666c64f396915050271cc40e5874448b5e876ea6" + "44cb1887e70cc6acd0cf6bfc13146261748c5450d8e21f8980ac7defda811b";
    const signedBinData = await wallet.signMessage(binData);
    (0, _chai.expect)(signedBinData).to.equal(expectedSignedBinData);
  });
  const ensSample = {
    provider: _ethers.ethers.getDefaultProvider(),
    name: "registrar.firefly.eth",
    address: "0x6fC21092DA55B392b045eD78F4732bff3C580e2c"
  };
  it("should resolve ENS name", async function () {
    const address = await ensSample.provider.resolveName(ensSample.name);
    (0, _chai.expect)(address).to.equal(ensSample.address);
  });
  it("should lookup ENS address", async function () {
    const name = await ensSample.provider.lookupAddress(ensSample.address);
    (0, _chai.expect)(name).to.equal(ensSample.name);
  });
  it("should instantiate a contract object", async function () {
    const contractABI = ["event ValueChanged(address indexed author, string oldValue, string newValue)", "constructor(string value)", "function getValue() view returns (string value)", "function setValue(string value)"];
    const contractAddress = "0x2bD9aAa2953F988153c8629926D22A6a5F69b14E";
    contract = new _ethers.ethers.Contract(contractAddress, contractABI, wallet);
    (0, _chai.expect)(contract.address).to.be.equals(contractAddress);
  });
});
describe("ethers.js - slow test cases", function () {
  xit("should get/set contract's value", async function () {
    const currentValue = await contract.getValue();
    const message = `I like dogs ${randomWallet.mnemonic}`;
    (0, _chai.expect)(currentValue).to.be.not.equals(message);
    const updateValueTx = await contract.setValue(message);
    await ropstenProvider.waitForTransaction(updateValueTx.hash);
    const newValue = await contract.getValue();
    (0, _chai.expect)(newValue).to.equal(message);
  });
  xit("should watch contract's ValueChanged event", async function () {
    const oldValue = await contract.getValue();
    const newValue = `I like cats ${randomWallet.mnemonic}`;
    const tx = await contract.setValue(newValue);
    await waitForEvent("ValueChanged", [wallet.address, oldValue, newValue]);
    await ropstenProvider.waitForTransaction(tx.hash);
  });
  it("should broadcast signed tx", async function () {
    rawTx.nonce = await ropstenProvider.getTransactionCount(wallet.address);
    const signedTx = await wallet.sign(rawTx);
    const sentTx = await ropstenProvider.sendTransaction(signedTx);
    (0, _chai.expect)(sentTx).not.to.be.undefined;
    await ropstenProvider.waitForTransaction(sentTx.hash);
    const txResponse = await ropstenProvider.getTransaction(sentTx.hash);
    (0, _chai.expect)(txResponse.blockHash).to.be.not.undefined;
  });
});