import type { ResponseStyle } from "../generated/client";
import type { RetryConfig } from "./retry";

declare module "../generated/client" {
  interface RequestOptions<
    TData = unknown,
    TResponseStyle extends ResponseStyle = "fields",
    ThrowOnError extends boolean = boolean,
    Url extends string = string,
  > {
    retry?: Partial<RetryConfig>;
  }
}
