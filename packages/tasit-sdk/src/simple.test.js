import { expect } from "chai";
import { ethers } from "ethers";
import Web3 from "web3";

import TasitContracts from "../../tasit-contracts/dist";
const { ropsten } = TasitContracts;
const { MANAToken } = ropsten;
const { address: MANA_ADDRESS, abi } = MANAToken;

const minterPrivKey =
  "0x11d943d7649fbdeb146dc57bd9cfc80b086bfab2330c7b25651dbaf382392f60";

describe("Simple test", () => {
  const web3 = new Web3("http://localhost:8545");
  const provider = new ethers.providers.JsonRpcProvider();

  it("ethers", async () => {
    const ZERO = `0`;
    const ONE = web3.utils.toWei("1.23", "ether");

    let minter = new ethers.Wallet(minterPrivKey);
    let bobAddress = "0x8a5d5298dccea526754064b8094e663162e1dbea";

    minter = minter.connect(provider);

    const mana = new ethers.Contract(MANA_ADDRESS, abi, minter);
    const balanceBefore = await mana.balanceOf(bobAddress);
    expect(`${balanceBefore}`).to.equal(ZERO);
    const mintTx = await mana.mint(bobAddress, ONE);

    mana.on("Mint", console.log);

    await provider.waitForTransaction(mintTx.hash);
    //console.log(mintTx);
    const receipt = await provider.getTransactionReceipt(mintTx.hash);
    //console.log(receipt);
    const balanceAfter = await mana.balanceOf(bobAddress);
    expect(`${balanceAfter}`).to.equal(ONE);
  });

  it.skip("web3", async () => {
    const ZERO = "0";
    const ONE = web3.utils.toWei("1", "ether");

    const minter = web3.eth.accounts.privateKeyToAccount(minterPrivKey);
    let bobAddress = "0x8a5d5298dccea526754064b8094e663162e1dbea";
    const { address: minterAddress } = minter;

    const mana = new web3.eth.Contract(abi, MANA_ADDRESS, {
      from: minterAddress,
    });
    const balanceBefore = await mana.methods.balanceOf(bobAddress).call();
    expect(`${balanceBefore}`).to.equal(ZERO);
    const mintTx = await mana.methods
      .mint(bobAddress, ONE)
      .send({ from: minterAddress });

    const balanceAfter = await mana.methods.balanceOf(bobAddress).call();
    expect(`${balanceAfter}`).to.equal(ONE);
  });
});
