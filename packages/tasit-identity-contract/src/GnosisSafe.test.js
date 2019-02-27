import Action from "tasit-action";
const { ConfigLoader, ERC20, ERC721 } = Action;
const { DetailedERC20 } = ERC20;
const { NFT } = ERC721;
import { ethers } from "ethers";
import { expect } from "chai";
import GnosisSafe from "./GnosisSafe";
import { local as localAddresses } from "../../tasit-contracts/3rd-parties/gnosis/addresses";
import { createFromPrivateKey } from "../../tasit-account/dist/testHelpers/helpers";
import {
  mineBlocks,
  createSnapshot,
  revertFromSnapshot,
  confirmBalances,
} from "tasit-action/dist/testHelpers/helpers";

// The goal of this integration test suite is to use only exposed classes
// from TasitSdk. ProviderFactory is used here as an exception
// as the clearest way to get a provider
// in this test suite. Eventually, maybe ProviderFactory may move to
// some shared helper dir.
import ProviderFactory from "tasit-action/dist/ProviderFactory";

const { GnosisSafe: GNOSIS_SAFE_ADDRESS } = localAddresses;
const ERC20_ADDRESS = "0x37E1A58dD465D33263D00185D065Ee36DD34CDb4";
const NFT_ADDRESS = "0x0E86f209729bf54763789CDBcA9E8b94f0FD5333";

const { utils: ethersUtils } = ethers;
const { bigNumberify } = ethersUtils;

const ZERO = 0;
const ONE = bigNumberify(`${1e18}`);

// 100 gwei
const GAS_PRICE = bigNumberify(`${1e11}`);

describe.skip("GnosisSafe", () => {
  const config = {
    provider: {
      network: "other",
      provider: "jsonrpc",
      pollingInterval: 50,
      jsonRpc: {
        url: "http://localhost",
        port: 8545,
      },
    },
    events: {
      timeout: 2000,
    },
  };
  let gnosisSafe;
  let anaWallet;
  let ephemeralWallet;
  let snapshotId;
  let provider;
  let erc20;
  let nft;

  before("", async () => {
    ConfigLoader.setConfig(config);

    provider = ProviderFactory.getProvider();

    const anaPrivateKey =
      "0x11d943d7649fbdeb146dc57bd9cfc80b086bfab2330c7b25651dbaf382392f60";

    anaWallet = createFromPrivateKey(anaPrivateKey);

    // Not using Account.create() because tasit-action isn't a dependency of that package
    const noFundsPrivateKey =
      "0x01234567890ABCDEF01234567890ABCDEF01234567890ABCDEF01234567890AB";
    ephemeralWallet = createFromPrivateKey(noFundsPrivateKey);

    // Contract deployment setup with ana (accounts[0]) as the only owner
    // To change that, edit the file "tasit-contract/3rd-parties/gnosis/scripts/2_deploy_contracts.js"
    gnosisSafe = new GnosisSafe(GNOSIS_SAFE_ADDRESS);

    erc20 = new DetailedERC20(ERC20_ADDRESS);

    nft = new NFT(NFT_ADDRESS);
  });

  beforeEach("", async () => {
    snapshotId = await createSnapshot(provider);

    const etherBalance = await provider.getBalance(GNOSIS_SAFE_ADDRESS);
    expect(`${etherBalance}`).to.equal(`${ZERO}`);

    const erc20Balance = await erc20.balanceOf(GNOSIS_SAFE_ADDRESS);
    expect(`${erc20Balance}`).to.equal(`${ZERO}`);

    gnosisSafe.removeWallet();
    erc20.removeWallet();
  });

  afterEach("", async () => {
    expect(erc20.subscribedEventNames()).to.be.empty;
    expect(gnosisSafe.subscribedEventNames()).to.be.empty;
    expect(provider._events).to.be.empty;

    await revertFromSnapshot(provider, snapshotId);
  });

  describe("test cases that needs ETH deposit to the wallet", async () => {
    beforeEach("faucet", async () => {
      anaWallet = anaWallet.connect(provider);
      const tx = await anaWallet.sendTransaction({
        to: GNOSIS_SAFE_ADDRESS,
        value: ONE,
      });
      await provider.waitForTransaction(tx.hash);

      const balance = await provider.getBalance(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`${ONE}`);
    });

    it("wallet owner should withdraw some ethers", async () => {
      const signers = [anaWallet];
      const { address: toAddress } = anaWallet;
      const value = ONE;

      gnosisSafe.setWallet(anaWallet);
      const execTxAction = await gnosisSafe.transferEther(
        signers,
        toAddress,
        value
      );
      await execTxAction.waitForNonceToUpdate();

      const balance = await provider.getBalance(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`${ZERO}`);
    });
  });

  describe("test cases that needs ERC20 deposit to the wallet", async () => {
    beforeEach("faucet", async () => {
      const { address: anaAddress } = anaWallet;

      erc20.setWallet(anaWallet);
      const mintAction = erc20.mint(GNOSIS_SAFE_ADDRESS, ONE);
      await mintAction.waitForNonceToUpdate();

      const balance = await erc20.balanceOf(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`${ONE}`);
    });

    it("wallet owner should withdraw some ERC20 tokens", async () => {
      const signers = [anaWallet];
      const tokenAddress = ERC20_ADDRESS;
      const { address: toAddress } = anaWallet;
      const value = ONE;

      gnosisSafe.setWallet(anaWallet);
      const action = await gnosisSafe.transferERC20(
        signers,
        tokenAddress,
        toAddress,
        value
      );
      await action.waitForNonceToUpdate();

      const balance = await erc20.balanceOf(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`${ZERO}`);
    });
  });

  describe("test cases that needs NFT deposit to the wallet", async () => {
    const tokenId = 1;

    beforeEach("faucet", async () => {
      const { address: anaAddress } = anaWallet;

      nft.setWallet(anaWallet);
      const mintAction = nft.mint(GNOSIS_SAFE_ADDRESS, tokenId);
      await mintAction.waitForNonceToUpdate();

      const balance = await nft.balanceOf(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`1`);
    });

    it("wallet owner should withdraw a NFT token", async () => {
      const signers = [anaWallet];
      const tokenAddress = NFT_ADDRESS;
      const { address: toAddress } = anaWallet;

      gnosisSafe.setWallet(anaWallet);
      const execTxAction = await gnosisSafe.transferNFT(
        signers,
        tokenAddress,
        toAddress,
        tokenId
      );
      await execTxAction.waitForNonceToUpdate();

      const balance = await erc20.balanceOf(GNOSIS_SAFE_ADDRESS);
      expect(`${balance}`).to.equal(`${ZERO}`);
    });
  });

  it("wallet owner should add an account as signer", async () => {
    const { address: anaAddress } = anaWallet;

    const ownersBefore = await gnosisSafe.getOwners();
    expect(ownersBefore).deep.equal([anaAddress]);

    const thresholdBefore = await gnosisSafe.getThreshold();
    expect(`${thresholdBefore}`).to.equal(`1`);

    const signers = [anaWallet];
    const { address: newSignerAddress } = ephemeralWallet;
    const newThreshold = `2`;

    gnosisSafe.setWallet(anaWallet);
    const action = await gnosisSafe.addSignerWithThreshold(
      signers,
      newSignerAddress,
      newThreshold
    );
    await action.waitForNonceToUpdate();

    const ownersAfter = await gnosisSafe.getOwners();
    expect(ownersAfter).deep.equal([newSignerAddress, anaAddress]);

    const thresholdAdter = await gnosisSafe.getThreshold();
    expect(`${thresholdAdter}`).to.equal(`2`);
  });

  // TODO:
  // - Setup DailyLimitModule to the Gnosis Safe Contract
  // - Move to tasit-link-wallet
  it.skip("wallet owner should approve an ephemeral account to spend funds", async () => {});
});
