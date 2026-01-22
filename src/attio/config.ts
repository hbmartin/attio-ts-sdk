import process from "node:process";
import { z } from "zod";
import type { Config, ResponseStyle } from "../generated/client";
import type { RetryConfig } from "./retry";

const TRAILING_SLASHES_REGEX = /\/+$/;

const DEFAULT_BASE_URL = "https://api.attio.com";

interface AttioClientConfig
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

const getEnvValue = (key: string): string | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }
  return process.env?.[key];
};

const normalizeBaseUrl = (baseUrl: string): string => {
  return baseUrl.replace(TRAILING_SLASHES_REGEX, "");
};

const resolveBaseUrl = (config?: AttioClientConfig): string => {
  const candidate =
    config?.baseUrl ?? getEnvValue("ATTIO_BASE_URL") ?? DEFAULT_BASE_URL;
  return normalizeBaseUrl(candidate);
};

const resolveAuthToken = (config?: AttioClientConfig): string | undefined => {
  return (
    config?.apiKey ??
    config?.accessToken ??
    config?.authToken ??
    getEnvValue("ATTIO_API_KEY") ??
    getEnvValue("ATTIO_ACCESS_TOKEN")
  );
};

const AuthTokenSchema = z
  .string({
    required_error: "Missing Attio API key. Set ATTIO_API_KEY or pass apiKey.",
  })
  .min(10, "Invalid Attio API key: too short.")
  .refine((t) => !/\s/.test(t), "Invalid Attio API key: contains whitespace.");

const validateAuthToken = (token: string | undefined): string => {
  return AuthTokenSchema.parse(token);
};

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
  validateAuthToken,
  resolveResponseStyle,
  resolveThrowOnError,
};
