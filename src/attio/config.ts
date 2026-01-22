import process from "node:process";
import type { Config, ResponseStyle } from "../generated/client";
import type { RetryConfig } from "./retry";

export const DEFAULT_BASE_URL = "https://api.attio.com";

export interface AttioClientConfig
  extends Omit<Config, "auth" | "baseUrl" | "headers"> {
  apiKey?: string;
  accessToken?: string;
  authToken?: string;
  baseUrl?: string;
  headers?: Config["headers"];
  timeoutMs?: number;
  retry?: Partial<RetryConfig>;
  cache?: {
    enabled?: boolean;
    key?: string;
  };
  responseStyle?: ResponseStyle;
  throwOnError?: boolean;
}

export const getEnvValue = (key: string): string | undefined => {
  if (typeof process === "undefined") return undefined;
  return process.env?.[key];
};

export const normalizeBaseUrl = (baseUrl: string): string => {
  return baseUrl.replace(/\/+$/, "");
};

export const resolveBaseUrl = (config?: AttioClientConfig): string => {
  const candidate =
    config?.baseUrl ?? getEnvValue("ATTIO_BASE_URL") ?? DEFAULT_BASE_URL;
  return normalizeBaseUrl(candidate);
};

export const resolveAuthToken = (
  config?: AttioClientConfig,
): string | undefined => {
  return (
    config?.apiKey ??
    config?.accessToken ??
    config?.authToken ??
    getEnvValue("ATTIO_API_KEY") ??
    getEnvValue("ATTIO_ACCESS_TOKEN")
  );
};

export const validateAuthToken = (token: string | undefined): string => {
  if (!token || typeof token !== "string") {
    throw new Error("Missing Attio API key. Set ATTIO_API_KEY or pass apiKey.");
  }

  if (/\s/.test(token)) {
    throw new Error("Invalid Attio API key: contains whitespace.");
  }

  if (token.length < 10) {
    throw new Error("Invalid Attio API key: too short.");
  }

  return token;
};

export const resolveResponseStyle = (
  config?: AttioClientConfig,
): ResponseStyle => config?.responseStyle ?? "fields";

export const resolveThrowOnError = (config?: AttioClientConfig): boolean =>
  config?.throwOnError ?? true;
