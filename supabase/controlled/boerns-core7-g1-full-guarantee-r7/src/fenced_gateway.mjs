import { payloadDigest } from "./canonical.mjs";

export class FencedGateway {
  #store;
  #binding;
  #adapters;

  constructor({ store, binding, adapters }) {
    this.#store = store;
    this.#binding = Object.freeze({ ...binding });
    this.#adapters = Object.freeze({ ...adapters });
  }

  async write(adapterName, sideEffectKey, request) {
    const adapter = this.#adapters[adapterName];
    if (!adapter || typeof adapter.writeFenced !== "function") {
      throw new TypeError("write adapter is not enabled");
    }
    if (!sideEffectKey || typeof sideEffectKey !== "string") {
      throw new TypeError("sideEffectKey is required");
    }
    const effect = Object.freeze({
      adapterName,
      sideEffectKey,
      requestDigest: payloadDigest(request),
    });
    const adapterContext = Object.freeze({
      claim: this.#binding,
      effect,
    });
    return this.#store.writeOnce(this.#binding, effect, () => (
      adapter.writeFenced(request, adapterContext)
    ));
  }
}
