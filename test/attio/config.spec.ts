import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BASE_URL,
  getEnvValue,
  normalizeBaseUrl,
  resolveAuthToken,
  resolveBaseUrl,
  resolveResponseStyle,
  resolveThrowOnError,
  validateAuthToken,
} from "../../src/attio/config";

describe("getEnvValue", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns environment variable value when set", () => {
    process.env.TEST_VAR = "test-value";
    expect(getEnvValue("TEST_VAR")).toBe("test-value");
  });

  it("returns undefined when variable not set", () => {
    delete process.env.NONEXISTENT_VAR;
    expect(getEnvValue("NONEXISTENT_VAR")).toBeUndefined();
  });
});

describe("normalizeBaseUrl", () => {
  it("removes trailing slashes", () => {
    expect(normalizeBaseUrl("https://api.attio.com/")).toBe(
      "https://api.attio.com",
    );
    expect(normalizeBaseUrl("https://api.attio.com///")).toBe(
      "https://api.attio.com",
    );
  });

  it("returns url unchanged when no trailing slash", () => {
    expect(normalizeBaseUrl("https://api.attio.com")).toBe(
      "https://api.attio.com",
    );
  });
});

describe("resolveBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ATTIO_BASE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses config baseUrl when provided", () => {
    expect(resolveBaseUrl({ baseUrl: "https://custom.api.com/" })).toBe(
      "https://custom.api.com",
    );
  });

  it("uses ATTIO_BASE_URL env var when config not provided", () => {
    process.env.ATTIO_BASE_URL = "https://env.api.com/";
    expect(resolveBaseUrl()).toBe("https://env.api.com");
  });

  it("uses default base URL when no config or env var", () => {
    expect(resolveBaseUrl()).toBe(DEFAULT_BASE_URL);
  });

  it("prioritizes config over env var", () => {
    process.env.ATTIO_BASE_URL = "https://env.api.com/";
    expect(resolveBaseUrl({ baseUrl: "https://config.api.com/" })).toBe(
      "https://config.api.com",
    );
  });
});

describe("resolveAuthToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ATTIO_API_KEY;
    delete process.env.ATTIO_ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses apiKey from config", () => {
    expect(resolveAuthToken({ apiKey: "api-key-123" })).toBe("api-key-123");
  });

  it("uses accessToken from config", () => {
    expect(resolveAuthToken({ accessToken: "access-token-456" })).toBe(
      "access-token-456",
    );
  });

  it("uses authToken from config", () => {
    expect(resolveAuthToken({ authToken: "auth-token-789" })).toBe(
      "auth-token-789",
    );
  });

  it("prioritizes apiKey over accessToken and authToken", () => {
    expect(
      resolveAuthToken({
        apiKey: "api-key",
        accessToken: "access-token",
        authToken: "auth-token",
      }),
    ).toBe("api-key");
  });

  it("prioritizes accessToken over authToken", () => {
    expect(
      resolveAuthToken({
        accessToken: "access-token",
        authToken: "auth-token",
      }),
    ).toBe("access-token");
  });

  it("uses ATTIO_API_KEY env var", () => {
    process.env.ATTIO_API_KEY = "env-api-key";
    expect(resolveAuthToken()).toBe("env-api-key");
  });

  it("uses ATTIO_ACCESS_TOKEN env var when ATTIO_API_KEY not set", () => {
    process.env.ATTIO_ACCESS_TOKEN = "env-access-token";
    expect(resolveAuthToken()).toBe("env-access-token");
  });

  it("prioritizes config over env vars", () => {
    process.env.ATTIO_API_KEY = "env-api-key";
    expect(resolveAuthToken({ apiKey: "config-api-key" })).toBe(
      "config-api-key",
    );
  });

  it("returns undefined when no token found", () => {
    expect(resolveAuthToken()).toBeUndefined();
  });
});

describe("validateAuthToken", () => {
  it("returns valid token unchanged", () => {
    expect(validateAuthToken("valid_token_12345")).toBe("valid_token_12345");
  });

  it("throws when token is undefined", () => {
    expect(() => validateAuthToken(undefined)).toThrow(
      "Missing Attio API key. Set ATTIO_API_KEY or pass apiKey.",
    );
  });

  it("throws when token is empty string", () => {
    expect(() => validateAuthToken("")).toThrow(
      "Missing Attio API key. Set ATTIO_API_KEY or pass apiKey.",
    );
  });

  it("throws when token contains whitespace", () => {
    expect(() => validateAuthToken("token with space")).toThrow(
      "Invalid Attio API key: contains whitespace.",
    );
    expect(() => validateAuthToken("token\twith\ttab")).toThrow(
      "Invalid Attio API key: contains whitespace.",
    );
  });

  it("throws when token is too short", () => {
    expect(() => validateAuthToken("short")).toThrow(
      "Invalid Attio API key: too short.",
    );
  });
});

describe("resolveResponseStyle", () => {
  it("returns config responseStyle when provided", () => {
    expect(resolveResponseStyle({ responseStyle: "headers" })).toBe("headers");
  });

  it("returns default 'fields' when no config", () => {
    expect(resolveResponseStyle()).toBe("fields");
    expect(resolveResponseStyle({})).toBe("fields");
  });
});

describe("resolveThrowOnError", () => {
  it("returns config throwOnError when provided", () => {
    expect(resolveThrowOnError({ throwOnError: false })).toBe(false);
  });

  it("returns default true when no config", () => {
    expect(resolveThrowOnError()).toBe(true);
    expect(resolveThrowOnError({})).toBe(true);
  });
});
