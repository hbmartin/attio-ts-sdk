import process from "node:process";
import { z } from "zod";
import type { Config, ResponseStyle } from "../generated/client";
import { AttioConfigError } from "./errors";
import type { RetryConfig } from "./retry";

const TRAILING_SLASHES_REGEX = /\/+$/;
const WHITESPACE_REGEX = /\s/;

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

const MISSING_API_KEY_ERROR =
  "Missing Attio API key. Set ATTIO_API_KEY or pass apiKey.";

const AuthTokenSchema = z
  .string()
  .min(1, MISSING_API_KEY_ERROR)
  .min(10, "Invalid Attio API key: too short.")
  .refine(
    (t) => !WHITESPACE_REGEX.test(t),
    "Invalid Attio API key: contains whitespace.",
  );

const validateAuthToken = (token: string | undefined): string => {
  if (token === undefined || token.length === 0) {
    throw new AttioConfigError(MISSING_API_KEY_ERROR, {
      code: "MISSING_API_KEY",
    });
  }
  const result = AuthTokenSchema.safeParse(token);
  if (!result.success) {
    throw new AttioConfigError(result.error.issues[0].message, {
      code: "INVALID_API_KEY",
    });
  }
  return result.data;
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
