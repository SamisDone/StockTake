import { describe, expect, it } from "vitest";
import { said } from "@/domain/error-copy";
import { DomainError } from "@/domain/errors";
import { field, formError } from "./form-state";

describe("formError", () => {
  it("turns a domain failure into a message next to its field", () => {
    const error = new DomainError("conflict", said("skuTaken"), "sku");
    expect(formError(error, "en", { sku: "WID-001" })).toEqual({
      error: { message: "Another product already uses that SKU.", field: "sku" },
      values: { sku: "WID-001" },
    });
  });

  it("says it in the reader's language, with Bangla digits", () => {
    const error = new DomainError("insufficient_stock", said("notEnoughStock", { product: "Widget", onHand: 12 }));
    expect(error.message).toBe("Only 12 × Widget on hand.");
    expect(formError(error, "bn").error?.message).toBe("Widget মজুত আছে মাত্র ১২টি।");
  });

  it("rethrows anything unexpected instead of showing it to the person", () => {
    const bug = new TypeError("cannot read properties of undefined");
    expect(() => formError(bug, "en")).toThrow(bug);
  });
});

describe("field", () => {
  it("reads strings and turns missing fields and files into empty strings", () => {
    const data = new FormData();
    data.set("name", "Widget");
    data.set("photo", new Blob(["x"]));
    expect(field(data, "name")).toBe("Widget");
    expect(field(data, "photo")).toBe("");
    expect(field(data, "missing")).toBe("");
  });
});
