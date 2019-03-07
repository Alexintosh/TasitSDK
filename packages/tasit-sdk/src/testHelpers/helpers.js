import { ethers } from "ethers";
import { Action } from "../TasitSdk";
const { Contract, ERC20, ERC721, Marketplace } = Action;
const { Mana } = ERC20;
const { Estate, Land } = ERC721;
const { Decentraland } = Marketplace;
import DecentralandUtils from "../helpers/DecentralandUtils";
import TasitContracts from "../../../tasit-contracts/dist";
const { local: localContracts, ropsten: ropstenContracts } = TasitContracts;
const { LANDProxy } = localContracts;

// Helpers
import actionHelpers from "tasit-action/dist/testHelpers/helpers";
global = Object.assign(global, actionHelpers);

const {
  utils: ethersUtils,
  constants: ethersConstants,
  Contract: ethersContract,
} = ethers;

const setupContracts = async ownerWallet => {
  const {
    MANAToken,
    LANDRegistry,
    EstateRegistry,
    Marketplace,
  } = localContracts;

  const { address: MANA_ADDRESS } = MANAToken;
  const { address: LAND_PROXY_ADDRESS } = LANDProxy;
  const { address: ESTATE_ADDRESS } = EstateRegistry;
  const { address: MARKETPLACE_ADDRESS } = Marketplace;

  // Note: It would be cooler to use NFT here if
  // Decentraland Land contract followed ERC721 exactly
  const landContract = new Land(LAND_PROXY_ADDRESS, ownerWallet);
  const estateContract = new Estate(ESTATE_ADDRESS, ownerWallet);
  const manaContract = new Mana(MANA_ADDRESS, ownerWallet);
  const marketplaceContract = new Decentraland(
    MARKETPLACE_ADDRESS,
    ownerWallet
  );

  // const marketplaceInitialize = marketplaceContract.initialize(
  //   manaContract.getAddress(),
  //   estateContract.getAddress(),
  //   ownerWallet.address
  // );
  // await marketplaceInitialize.waitForNonceToUpdate();

  return {
    manaContract,
    landContract,
    estateContract,
    marketplaceContract,
  };
};

const createParcels = async (landContract, parcels, beneficiary) => {
  let xArray = [];
  let yArray = [];
  parcels.forEach(parcel => {
    xArray.push(parcel.x);
    yArray.push(parcel.y);
  });

  const parcelsAssignment = landContract.assignMultipleParcels(
    xArray,
    yArray,
    beneficiary.address,
    gasParams
  );
  await parcelsAssignment.waitForNonceToUpdate();
};

const createEstate = async (
  estateContract,
  landContract,
  estateName,
  parcels,
  ownerWallet
) => {
  landContract.setWallet(ownerWallet);

  let xArray = [];
  let yArray = [];
  parcels.forEach(parcel => {
    xArray.push(parcel.x);
    yArray.push(parcel.y);
  });

  const estateCreation = landContract.createEstateWithMetadata(
    xArray,
    yArray,
    ownerWallet.address,
    estateName,
    gasParams
  );

  const estateId = await new Promise(function(resolve, reject) {
    estateContract.once("CreateEstate", message => {
      const { data } = message;
      const { args } = data;
      resolve(args._estateId);
    });
  });

  await estateCreation.waitForNonceToUpdate();

  return estateId;
};

const createEstatesFromParcels = async (
  estateContract,
  landContract,
  parcels,
  beneficiary
) => {
  const estateIds = [];
  await createParcels(landContract, parcels, beneficiary);

  for (let parcel of parcels) {
    const id = await createEstate(
      estateContract,
      landContract,
      `cool estate ${parcel.x}x${parcel.y}`,
      [parcel],
      beneficiary
    );
    estateIds.push(id);
  }
  return estateIds;
};

const getEstateSellOrder = async (
  marketplaceContract,
  esteteContract,
  estateId
) => {
  const [
    orderId,
    seller,
    price,
    expiresAt,
  ] = await marketplaceContract.auctionByAssetId(estateId);

  const hasOrder = parseInt(orderId, 16) !== 0;
  if (!hasOrder) return null;

  const estateName = await esteteContract.getMetadata(estateId);

  return {
    estateId,
    estateName,
    orderId,
    seller,
    price,
    expiresAt,
  };
};

const duration = {
  seconds: function(val) {
    return val;
  },
  minutes: function(val) {
    return val * this.seconds(60);
  },
  hours: function(val) {
    return val * this.minutes(60);
  },
  days: function(val) {
    return val * this.hours(24);
  },
  weeks: function(val) {
    return val * this.days(7);
  },
  years: function(val) {
    return val * this.days(365);
  },
};

// The Mana contract deployed on ropsten network has a setBalance function
const ropstenManaFaucet = async (provider, walletWithGas, to, amountInWei) => {
  const { MANAToken } = ropstenContracts;
  const { address: MANA_ADDRESS } = MANAToken;
  const connectedWallet = walletWithGas.connect(provider);
  const manaABI = ["function setBalance(address to, uint256 amount)"];
  const mana = new ethersContract(MANA_ADDRESS, manaABI, connectedWallet);
  const tx = await mana.setBalance(to.address, amountInWei);
  await provider.waitForTransaction(tx.hash);
};

export const helpers = {
  mineBlocks,
  createSnapshot,
  revertFromSnapshot,
  confirmBalances,
  gasParams,
  setupContracts,
  duration,
  createParcels,
  createEstatesFromParcels,
  getEstateSellOrder,
  etherFaucet,
  erc20Faucet,
  ropstenManaFaucet,
  addressesAreEqual,
  bigNumberify,
  constants,
  ProviderFactory,
};

export default helpers;
