import type { BodyInit as UndiciBodyInit } from "undici-types";

declare global {
  interface AbortSignalConstructor {
    any(signals: AbortSignal[]): AbortSignal;
  }

  type BodyInit = UndiciBodyInit;
}
