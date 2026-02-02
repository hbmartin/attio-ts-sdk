import process from "node:process";
import type { Config, ResponseStyle } from "../generated/client";
import type { AttioCacheConfig } from "./cache";
import type { AttioClientHooks, AttioLogger } from "./hooks";
import type { RetryConfig } from "./retry";

const TRAILING_SLASHES_REGEX = /\/+$/;

const DEFAULT_BASE_URL = "https://api.attio.com";

interface AttioClientConfig
  extends Omit<Config, "auth" | "baseUrl" | "headers"> {
  apiKey?: string;
  accessToken?: string;
  authToken: string;
  baseUrl?: string;
  headers?: Config["headers"];
  timeoutMs?: number;
  retry?: Partial<RetryConfig>;
  cache?: AttioCacheConfig;
  hooks?: AttioClientHooks;
  logger?: AttioLogger;
  responseStyle?: ResponseStyle;
  throwOnError?: boolean;
}

const getEnvValue = (key: string): string | undefined => {
  if (typeof process === "undefined") {
    return;
  }
  return process.env?.[key];
};

const normalizeBaseUrl = (baseUrl: string): string =>
  baseUrl.replace(TRAILING_SLASHES_REGEX, "");

const resolveBaseUrl = (config?: AttioClientConfig): string => {
  const candidate =
    config?.baseUrl ?? getEnvValue("ATTIO_BASE_URL") ?? DEFAULT_BASE_URL;
  return normalizeBaseUrl(candidate);
};

const resolveAuthToken = (config?: AttioClientConfig): string | undefined =>
  config?.apiKey ??
  config?.accessToken ??
  config?.authToken ??
  getEnvValue("ATTIO_API_KEY") ??
  getEnvValue("ATTIO_ACCESS_TOKEN");

const resolveResponseStyle = (config?: AttioClientConfig): ResponseStyle =>
  config?.responseStyle ?? "fields";

const resolveThrowOnError = (config?: AttioClientConfig): boolean =>
  config?.throwOnError ?? true;

export type { AttioClientConfig };
export {
  DEFAULT_BASE_URL,
  getEnvValue,
  normalizeBaseUrl,
  resolveBaseUrl,
  resolveAuthToken,
  resolveResponseStyle,
  resolveThrowOnError,
};
