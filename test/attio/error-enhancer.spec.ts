import { describe, expect, it } from "vitest";

import { AttioApiError } from "../../src/attio/errors";
import {
  updateKnownFieldValues,
  enhanceAttioError,
} from "../../src/attio/error-enhancer";

describe("error-enhancer", () => {
  it("adds suggestions for select option mismatches", () => {
    updateKnownFieldValues("stage", ["Prospect", "Customer"]);

    const error = new AttioApiError(
      "Unknown select option name. constraint: Prospct",
      {
        data: {
          path: ["stage"],
        },
      },
    );

    const enhanced = enhanceAttioError(error);
    expect(enhanced.suggestions).toBeTruthy();
  });
});
