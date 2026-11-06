export type SerialOperationQueue = {
  run<T>(operation: () => Promise<T> | T): Promise<T>;
  drain(): Promise<void>;
};

export function createSerialOperationQueue(): SerialOperationQueue;
