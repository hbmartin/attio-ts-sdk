import { describe, expect, it } from "vitest";

import { filters } from "../../src/attio/filters";

describe("filters", () => {
  describe("eq", () => {
    it("creates an equality filter", () => {
      expect(filters.eq("name", "Acme")).toEqual({
        name: { $eq: "Acme" },
      });
    });

    it("handles numeric values", () => {
      expect(filters.eq("count", 42)).toEqual({
        count: { $eq: 42 },
      });
    });
  });

  describe("contains", () => {
    it("creates a contains filter", () => {
      expect(filters.contains("email", "@example.com")).toEqual({
        email: { $contains: "@example.com" },
      });
    });
  });

  describe("startsWith", () => {
    it("creates a starts_with filter", () => {
      expect(filters.startsWith("name", "Acme")).toEqual({
        name: { $starts_with: "Acme" },
      });
    });
  });

  describe("endsWith", () => {
    it("creates an ends_with filter", () => {
      expect(filters.endsWith("domain", ".com")).toEqual({
        domain: { $ends_with: ".com" },
      });
    });
  });

  describe("notEmpty", () => {
    it("creates a not_empty filter", () => {
      expect(filters.notEmpty("phone")).toEqual({
        phone: { $not_empty: true },
      });
    });
  });

  describe("and", () => {
    it("combines filters with AND", () => {
      const result = filters.and(
        filters.eq("status", "active"),
        filters.notEmpty("email"),
      );

      expect(result).toEqual({
        $and: [{ status: { $eq: "active" } }, { email: { $not_empty: true } }],
      });
    });

    it("handles single condition", () => {
      const result = filters.and(filters.eq("status", "active"));

      expect(result).toEqual({
        $and: [{ status: { $eq: "active" } }],
      });
    });
  });

  describe("or", () => {
    it("combines filters with OR", () => {
      const result = filters.or(
        filters.eq("status", "active"),
        filters.eq("status", "pending"),
      );

      expect(result).toEqual({
        $or: [{ status: { $eq: "active" } }, { status: { $eq: "pending" } }],
      });
    });
  });

  describe("not", () => {
    it("negates a filter", () => {
      const result = filters.not(filters.eq("status", "archived"));

      expect(result).toEqual({
        $not: { status: { $eq: "archived" } },
      });
    });
  });

  describe("complex combinations", () => {
    it("allows nested logical operators", () => {
      const result = filters.and(
        filters.eq("type", "company"),
        filters.or(
          filters.contains("name", "Inc"),
          filters.contains("name", "LLC"),
        ),
        filters.not(filters.eq("status", "deleted")),
      );

      expect(result).toEqual({
        $and: [
          { type: { $eq: "company" } },
          {
            $or: [
              { name: { $contains: "Inc" } },
              { name: { $contains: "LLC" } },
            ],
          },
          { $not: { status: { $eq: "deleted" } } },
        ],
      });
    });
  });
});
