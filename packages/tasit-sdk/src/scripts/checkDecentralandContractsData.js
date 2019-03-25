//
// Script used to check if the target chain has the Decentraland app pre-conditions
//
// Note: This script is using mocha for convenience but isn't a test suite to be run by the `test` script.
//

import { Action, ContractBasedAccount } from "../TasitSdk";
const { ERC20 } = Action;
const { Mana } = ERC20;

import DecentralandUtils from "../helpers/DecentralandUtils";

const fetch = require("node-fetch");

const { TWO, TEN, BILLION, WeiPerEther } = constants;

describe("Decentraland App pre-conditions", () => {
  const mana = new Mana(MANA_ADDRESS);
  const gnosisSafeOwner = accounts[9];
  const decentralandUtils = new DecentralandUtils();
  const { getAllAssetsForSale } = decentralandUtils;
  let assetsForSale = [];

  before("load assets for sale from blockchain", async () => {
    assetsForSale = await getAllAssetsForSale();
  });

  describe("Gnosis Safe wallet", () => {
    it("should have at least ten ethers", async () => {
      await expectMinimumEtherBalances(provider, [GNOSIS_SAFE_ADDRESS], [TEN]);
    });

    it("should have at least a billion MANA", async () => {
      await expectMinimumTokenBalances(mana, [GNOSIS_SAFE_ADDRESS], [BILLION]);
    });
  });

  describe("Gnosis Safe wallet owner", () => {
    it("should have at least ten ethers", async () => {
      await expectMinimumEtherBalances(provider, [GNOSIS_SAFE_ADDRESS], [TWO]);
    });
  });

  describe("Marketplace", () => {
    it("should have at least 100 assets for sale", async () => {
      expect(assetsForSale.length).to.be.at.least(100);
    });
  });

  it("Assets for sale", async () => {
    const minPrice = bigNumberify("10000").mul(WeiPerEther);
    const maxPrice = bigNumberify("100000").mul(WeiPerEther);

    const blankImage = await fetch(
      "https://api.decentraland.org/v1/estates/5/map.png"
    );
    const blankImageData = (await blankImage.buffer()).toString("base64");

    for (let asset of assetsForSale) {
      const { id, assetId, nftAddress, priceInWei } = asset;
      const price = bigNumberify(priceInWei);

      const isLand = addressesAreEqual(nftAddress, LAND_PROXY_ADDRESS);
      const isEstate = addressesAreEqual(nftAddress, ESTATE_ADDRESS);

      expect(price.gte(minPrice), `${price} isn't >= ${minPrice}`).to.be.true;
      expect(price.lte(maxPrice), `${price} isn't <= ${maxPrice}`).to.be.true;

      // Parcels always show correct image
      if (isEstate) {
        const image = await fetch(
          `https://api.decentraland.org/v1/estates/${assetId}/map.png`
        );
        const imageData = (await image.buffer()).toString("base64");
        expect(
          imageData,
          `The image of the estate (id: ${assetId}) is blank`
        ).not.equals(blankImageData);
      }
    }
  });
});
