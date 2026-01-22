import { afterEach, describe, expect, it } from "vitest";

import { AttioApiError, AttioNetworkError } from "../../src/attio/errors";
import {
	enhanceAttioError,
	getKnownFieldValues,
	updateKnownFieldValues,
} from "../../src/attio/error-enhancer";

afterEach(() => {
	updateKnownFieldValues("stage", []);
	updateKnownFieldValues("status", []);
});

describe("error-enhancer", () => {
	describe("updateKnownFieldValues", () => {
		it("stores field values", () => {
			updateKnownFieldValues("stage", ["Prospect", "Customer"]);
			expect(getKnownFieldValues("stage")).toEqual(["Prospect", "Customer"]);
		});

		it("deduplicates and trims values", () => {
			updateKnownFieldValues("stage", [
				" Prospect ",
				"Customer",
				"Prospect",
				"",
			]);
			expect(getKnownFieldValues("stage")).toEqual(["Prospect", "Customer"]);
		});

		it("deletes field when given empty values", () => {
			updateKnownFieldValues("stage", ["Prospect"]);
			updateKnownFieldValues("stage", []);
			expect(getKnownFieldValues("stage")).toBeUndefined();
		});

		it("deletes field when given only whitespace values", () => {
			updateKnownFieldValues("stage", ["  ", "\t"]);
			expect(getKnownFieldValues("stage")).toBeUndefined();
		});
	});

	describe("getKnownFieldValues", () => {
		it("returns undefined for unknown fields", () => {
			expect(getKnownFieldValues("unknown")).toBeUndefined();
		});

		it("returns stored values for known fields", () => {
			updateKnownFieldValues("status", ["Active", "Inactive"]);
			expect(getKnownFieldValues("status")).toEqual(["Active", "Inactive"]);
		});
	});

	describe("enhanceAttioError", () => {
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

		it("returns non-API errors unchanged", () => {
			const error = new AttioNetworkError("Network error");
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeUndefined();
		});

		it("returns error unchanged when no context can be extracted", () => {
			const error = new AttioApiError("Generic error");
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeUndefined();
		});

		it("returns error unchanged when field has no known values", () => {
			const error = new AttioApiError(
				"Unknown select option name. constraint: test",
				{
					data: { path: "unknown_field" },
				},
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeUndefined();
		});

		it("extracts field from path array", () => {
			updateKnownFieldValues("stage", ["Won", "Lost"]);
			const error = new AttioApiError(
				"Unknown select option name. constraint: Wn",
				{ data: { path: ["stage", "nested"] } },
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeDefined();
		});

		it("extracts field from field property", () => {
			updateKnownFieldValues("status", ["Active", "Inactive"]);
			const error = new AttioApiError(
				"Unknown select option name. constraint: Actve",
				{ data: { field: "status" } },
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeDefined();
		});

		it("extracts field from attribute property", () => {
			updateKnownFieldValues("category", ["Tech", "Finance"]);
			const error = new AttioApiError(
				"Unknown select option name. constraint: Tec",
				{ data: { attribute: "category" } },
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeDefined();
		});

		it("extracts value from option name pattern with single quotes", () => {
			updateKnownFieldValues("stage", ["Prospect", "Customer"]);
			const error = new AttioApiError(
				"Invalid option name 'Prospt' for field",
				{ data: { path: "stage" } },
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeDefined();
		});

		it("extracts value from option name pattern with double quotes", () => {
			updateKnownFieldValues("stage", ["Prospect", "Customer"]);
			const error = new AttioApiError(
				'Invalid option name "Prospt" for field',
				{ data: { path: "stage" } },
			);
			const result = enhanceAttioError(error);
			expect(result.suggestions).toBeDefined();
		});

		it("sorts suggestions by similarity", () => {
			updateKnownFieldValues("stage", ["Prospect", "Customer", "Lost"]);

			const error = new AttioApiError(
				"Unknown select option name. constraint: Prospct",
				{ data: { path: "stage" } },
			);

			const result = enhanceAttioError(error);
			const suggestions = result.suggestions as {
				bestMatch: string;
				matches: string[];
			};
			expect(suggestions.bestMatch).toBe("Prospect");
		});

		it("limits matches to 3", () => {
			updateKnownFieldValues("stage", [
				"Prospect",
				"Customer",
				"Lost",
				"Won",
				"Pending",
			]);

			const error = new AttioApiError(
				"Unknown select option name. constraint: test",
				{ data: { path: "stage" } },
			);

			const result = enhanceAttioError(error);
			const suggestions = result.suggestions as { matches: string[] };
			expect(suggestions.matches.length).toBeLessThanOrEqual(3);
		});

		it("includes attempted value in suggestions", () => {
			updateKnownFieldValues("stage", ["Prospect"]);

			const error = new AttioApiError(
				"Unknown select option name. constraint: Prospt",
				{ data: { path: "stage" } },
			);

			const result = enhanceAttioError(error);
			const suggestions = result.suggestions as { attempted: string };
			expect(suggestions.attempted).toBe("Prospt");
		});
	});
});
