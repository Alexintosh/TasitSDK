import "ethers/dist/shims.js";
// Note: ethers SHOULD be imported from their main object
// shims aren't injected with package import
import { ethers } from "ethers";
import Utils from "./Utils";
import ProviderFactory from "../ProviderFactory";
import Subscription from "./Subscription";
import Action from "./Action";

// Log levels: debug, default, info, warn, error, off
// See more: https://github.com/ethers-io/ethers.js/blob/527de7ba5e1d31bd7c166a78d0fa62b58bf50a54/src.ts/errors.ts
ethers.errors.setLogLevel("error");

export class Contract extends Subscription {
  #provider;
  #ethersContract;
  #isRunning = false;

  constructor(address, abi, wallet) {
    if (!Utils.isAddress(address) || !Utils.isABI(abi))
      throw new Error(`Cannot create a Contract without a address and ABI`);

    if (wallet && !Utils.isEthersJsSigner(wallet))
      throw new Error(`Cannot set an invalid wallet for a Contract`);

    const provider = ProviderFactory.getProvider();

    // If there's a wallet, connect it with provider.
    // Otherwise use provider directly (for read operations only).
    const signerOrProvider = wallet ? wallet.connect(provider) : provider;

    const ethersContract = new ethers.Contract(address, abi, signerOrProvider);

    super(ethersContract);
    this.#provider = provider;
    this.#ethersContract = ethersContract;
    this.#addFunctionsToContract();
  }

  // Note: For now, `tasit-account` creates a ethers.js wallet object
  // If that changes, maybe this method could be renamed to setAccount()
  setWallet = wallet => {
    if (!Utils.isEthersJsSigner(wallet))
      throw new Error(`Cannot set an invalid wallet for a Contract`);

    this.#ethersContract = new ethers.Contract(
      this.#ethersContract.address,
      this.#ethersContract.interface.abi,
      wallet.connect(this.#provider)
    );

    this.#addFunctionsToContract();
  };

  getWallet = () => {
    const { signer: wallet } = this.#ethersContract;
    return wallet;
  };

  removeWallet = () => {
    this.#ethersContract = new ethers.Contract(
      this.#ethersContract.address,
      this.#ethersContract.interface.abi,
      this.#provider
    );
    this.#addFunctionsToContract();
  };

  getAddress = () => {
    return this.#ethersContract.address;
  };

  getABI = () => {
    return this.#ethersContract.interface.abi;
  };

  // For testing purposes
  _getProvider = () => {
    return this.#provider;
  };

  on = (eventName, listener) => {
    this.#addListener(eventName, listener, false);
  };

  once = (eventName, listener) => {
    this.#addListener(eventName, listener, true);
  };

  #addListener = (eventName, listener, once) => {
    if (!this.#isEventValid(eventName))
      throw new Error(`Event '${eventName}' not found.`);

    if (eventName === "error" && once)
      throw new Error(`Use on() function to subscribe to an error event.`);

    if (eventName === "error") {
      this._addErrorListener(listener);
    } else {
      this.#addContractEventListener(eventName, listener, once);
    }
  };

  #addContractEventListener = (eventName, listener, once) => {
    const baseEthersListener = async (...args) => {
      try {
        // Note: This depends on the current ethers.js specification of ethersContract events to work:
        // "All event callbacks receive the parameters specified in the ABI as well as
        // one additional Event Object"
        // https://docs.ethers.io/ethers.js/html/api-ethersContract.html#event-object
        // TODO: Consider checking that the event looks like what we expect and
        // erroring out if not
        const event = args.pop();

        const message = {
          data: {
            args: event.args,
          },
        };

        // Note: Unsubscribing should be done only if the user's listener function will be called
        if (once) this.off(eventName);
        await listener(message);
      } catch (error) {
        this._emitErrorEventFromEventListener(
          new Error(`Listener function with error: ${error.message}`),
          eventName
        );
      }
    };

    // Note:
    // On the development env (using ganache-cli)
    // Blocks are being mined simultaneously and generating a sort of unexpected behaviors like:
    // - once listeners called many times
    // - sequential blocks giving same confirmation to a transaction
    // - false-positive reorg event emission
    // - collaborating for tests non-determinism
    //
    // Tech debt:
    // See if there is another way to avoid these problems, if not
    // this solution should be improved with a state structure identifying state per event
    //
    // Question:
    // Is it possible that that behavior (listener concurrent calls for the same event) is desirable?
    const ethersListener = async (...args) => {
      if (this.#isRunning) {
        console.info(`Listener is already running`);
        return;
      }
      this.#isRunning = true;
      await baseEthersListener(...args);
      this.#isRunning = false;
    };

    this._addEventListener(eventName, ethersListener);
  };

  #isEventValid = eventName => {
    return (
      eventName === "error" ||
      this.#ethersContract.interface.events[eventName] !== undefined
    );
  };

  #addFunctionsToContract = () => {
    this.#ethersContract.interface.abi
      .filter(json => {
        return json.type === "function";
      })
      .forEach(f => {
        var isWrite =
          (f.constant === undefined &&
            f.stateMutability !== "view" &&
            f.stateMutability !== "pure") ||
          (f.constant !== undefined && f.constant === false);
        if (isWrite) this.#attachWriteFunction(f);
        else {
          this.#attachReadFunction(f);
        }
      });
  };

  #attachReadFunction = f => {
    this[f.name] = async (...args) => {
      const value = await this.#ethersContract[f.name](...args);
      return value;
    };
  };

  #attachWriteFunction = f => {
    this[f.name] = (...args) => {
      if (!Utils.isEthersJsSigner(this.#ethersContract.signer))
        throw new Error(`Cannot write data to a Contract without a wallet`);

      const { signer, address } = this.#ethersContract;
      const data = this.#ethersContract.interface.functions[f.name].encode(
        args
      );

      const rawTx = { to: address, data };

      const action = new Action(rawTx, this.#provider, signer);

      const errorListener = error => {
        this._emitErrorEvent(error);
      };

      action.on("error", errorListener);

      return action;
    };
  };
}

export default Contract;
