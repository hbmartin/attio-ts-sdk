declare global {
  interface AbortSignalConstructor {
    any(signals: AbortSignal[]): AbortSignal;
  }
}

export {};
