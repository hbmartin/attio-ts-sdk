import { describe, expect, it } from "vitest";
import { getEnvValue } from "../../src/attio/config";
import { createAttioSdk } from "../../src/attio/sdk";

const apiKey = getEnvValue("ATTIO_API_KEY");

describe("attio integration", () => {
  it.skipIf(!apiKey)("lists workspace objects through the SDK", async () => {
    const sdk = createAttioSdk({ apiKey });

    const objects = await sdk.objects.list();

    expect(Array.isArray(objects)).toBe(true);
  });
});
