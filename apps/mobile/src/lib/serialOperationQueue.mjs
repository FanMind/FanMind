function createSerialOperationQueue() {
  let tail = Promise.resolve();

  return {
    run(operation) {
      if (typeof operation !== "function") {
        return Promise.reject(new TypeError("operation must be a function"));
      }
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    drain() {
      return tail;
    },
  };
}

export { createSerialOperationQueue };
