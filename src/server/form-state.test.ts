import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { field, formError } from "./form-state";

describe("formError", () => {
  it("turns a domain failure into a message next to its field", () => {
    const error = new DomainError("conflict", "That SKU is taken.", "sku");
    expect(formError(error, { sku: "WID-001" })).toEqual({
      error: { message: "That SKU is taken.", field: "sku" },
      values: { sku: "WID-001" },
    });
  });

  it("rethrows anything unexpected instead of showing it to the person", () => {
    const bug = new TypeError("cannot read properties of undefined");
    expect(() => formError(bug)).toThrow(bug);
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
