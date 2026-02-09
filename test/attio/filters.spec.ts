import { describe, expect, it } from "vitest";

import {
  attioFilterSchema,
  filters,
  parseAttioFilter,
} from "../../src/attio/filters";

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

  describe("lt", () => {
    it("creates a less than filter", () => {
      expect(filters.lt("price", 100)).toEqual({
        price: { $lt: 100 },
      });
    });

    it("handles date values", () => {
      const date = "2024-01-01";
      expect(filters.lt("created_at", date)).toEqual({
        created_at: { $lt: date },
      });
    });
  });

  describe("lte", () => {
    it("creates a less than or equal filter", () => {
      expect(filters.lte("quantity", 50)).toEqual({
        quantity: { $lte: 50 },
      });
    });
  });

  describe("gt", () => {
    it("creates a greater than filter", () => {
      expect(filters.gt("revenue", 1_000_000)).toEqual({
        revenue: { $gt: 1_000_000 },
      });
    });
  });

  describe("gte", () => {
    it("creates a greater than or equal filter", () => {
      expect(filters.gte("score", 80)).toEqual({
        score: { $gte: 80 },
      });
    });
  });

  describe("in", () => {
    it("creates an in filter with array of values", () => {
      expect(filters.in("status", ["active", "pending", "review"])).toEqual({
        status: { $in: ["active", "pending", "review"] },
      });
    });

    it("handles numeric arrays", () => {
      expect(filters.in("priority", [1, 2, 3])).toEqual({
        priority: { $in: [1, 2, 3] },
      });
    });

    it("handles empty array", () => {
      expect(filters.in("category", [])).toEqual({
        category: { $in: [] },
      });
    });
  });

  describe("between", () => {
    it("creates a between filter with gte and lt", () => {
      expect(filters.between("price", 10, 100)).toEqual({
        price: { $gte: 10, $lt: 100 },
      });
    });

    it("handles date ranges", () => {
      expect(filters.between("created_at", "2024-01-01", "2024-12-31")).toEqual(
        {
          created_at: { $gte: "2024-01-01", $lt: "2024-12-31" },
        },
      );
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

  describe("path", () => {
    it("creates a path filter with constraints", () => {
      const result = filters.path(
        [
          ["candidates", "parent_record"],
          ["people", "email_addresses"],
        ],
        { email_domain: "apple.com" },
      );

      expect(result).toEqual({
        path: [
          ["candidates", "parent_record"],
          ["people", "email_addresses"],
        ],
        constraints: { email_domain: "apple.com" },
      });
    });

    it("supports multi-level paths", () => {
      const result = filters.path(
        [
          ["deals", "company"],
          ["companies", "contacts"],
          ["people", "location"],
        ],
        { city: "San Francisco" },
      );

      expect(result).toEqual({
        path: [
          ["deals", "company"],
          ["companies", "contacts"],
          ["people", "location"],
        ],
        constraints: { city: "San Francisco" },
      });
    });

    it("supports single segment path", () => {
      const result = filters.path([["companies", "owner"]], { active: true });

      expect(result).toEqual({
        path: [["companies", "owner"]],
        constraints: { active: true },
      });
    });

    it("supports multiple constraints", () => {
      const result = filters.path([["people", "company"]], {
        industry: "technology",
        size: "enterprise",
      });

      expect(result).toEqual({
        path: [["people", "company"]],
        constraints: {
          industry: "technology",
          size: "enterprise",
        },
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

    it("combines numeric operators with logical operators", () => {
      const result = filters.and(
        filters.gte("price", 100),
        filters.lt("price", 1000),
        filters.in("category", ["electronics", "computers"]),
      );

      expect(result).toEqual({
        $and: [
          { price: { $gte: 100 } },
          { price: { $lt: 1000 } },
          { category: { $in: ["electronics", "computers"] } },
        ],
      });
    });

    it("uses between with other filters", () => {
      const result = filters.and(
        filters.eq("status", "active"),
        filters.between("created_at", "2024-01-01", "2024-06-30"),
        filters.notEmpty("email"),
      );

      expect(result).toEqual({
        $and: [
          { status: { $eq: "active" } },
          { created_at: { $gte: "2024-01-01", $lt: "2024-06-30" } },
          { email: { $not_empty: true } },
        ],
      });
    });
  });

  describe("attioFilterSchema", () => {
    it("parses valid filters", () => {
      const filter = {
        $and: [
          { status: { $eq: "active" } },
          {
            path: [["companies", "owner"]],
            constraints: { email: { $contains: "@example.com" } },
          },
        ],
      };

      expect(attioFilterSchema.parse(filter)).toEqual(filter);
    });

    it("rejects invalid filter shapes", () => {
      expect(() =>
        attioFilterSchema.parse({
          status: { $not_empty: false },
        }),
      ).toThrow();
    });

    it("rejects empty field condition in nested attribute", () => {
      expect(() =>
        attioFilterSchema.parse({ status: { sub_field: {} } }),
      ).toThrow("Field condition must include at least one operator");
    });

    it("rejects attribute keys starting with $", () => {
      expect(() =>
        attioFilterSchema.parse({ $custom: { $eq: "value" } }),
      ).toThrow();
    });

    it("allows non-$ attribute keys", () => {
      const filter = { status: { $eq: "active" } };
      expect(attioFilterSchema.parse(filter)).toEqual(filter);
    });

    it("converts parsed filters to API-compatible record shape", () => {
      const filter = {
        status: { $eq: "active" },
      };

      expect(parseAttioFilter(filter)).toEqual(filter);
    });
  });
});
