import { describe, it, expect } from "vitest";
import {
  calculateAmount,
  generateInvoiceNumber,
  nextInvoiceNumberFrom,
  formatDuration,
  invoiceTotals,
  roundMoney,
} from "@/lib/utils";

describe("calculateAmount", () => {
  it("converts seconds and an hourly rate into a rounded amount", () => {
    expect(calculateAmount(3600, 100)).toBe(100);
    expect(calculateAmount(1800, 100)).toBe(50);
    expect(calculateAmount(5400, 80)).toBe(120);
  });

  it("rounds to two decimals rather than leaving float noise", () => {
    // 1000 seconds at 99.99/h = 27.775 -> must not surface as 27.774999...
    const result = calculateAmount(1000, 99.99);
    expect(result).toBe(27.78);
    expect(Number.isInteger(result * 100)).toBe(true);
  });

  it("returns zero for zero duration or zero rate", () => {
    expect(calculateAmount(0, 150)).toBe(0);
    expect(calculateAmount(7200, 0)).toBe(0);
  });
});

describe("generateInvoiceNumber", () => {
  it("starts a fresh sequence when there is no previous invoice", () => {
    expect(generateInvoiceNumber(null)).toBe("INV-001");
  });

  it("increments the numeric suffix and keeps zero padding", () => {
    expect(generateInvoiceNumber("INV-001")).toBe("INV-002");
    expect(generateInvoiceNumber("INV-009")).toBe("INV-010");
    expect(generateInvoiceNumber("INV-099")).toBe("INV-100");
  });

  it("grows past three digits without truncating", () => {
    expect(generateInvoiceNumber("INV-999")).toBe("INV-1000");
  });

  it("falls back to the first number for unrecognised formats", () => {
    expect(generateInvoiceNumber("CLK-ABC")).toBe("INV-001");
  });
});

describe("nextInvoiceNumberFrom", () => {
  it("starts at INV-001 when there are no invoices", () => {
    expect(nextInvoiceNumberFrom([])).toBe("INV-001");
  });

  it("picks the highest number regardless of array order", () => {
    expect(nextInvoiceNumberFrom(["INV-003", "INV-001", "INV-002"])).toBe("INV-004");
  });

  it("compares numerically, not as strings, past 999", () => {
    // A string sort would rank INV-999 above INV-1000 and reissue INV-1000,
    // colliding with the existing invoice.
    expect(nextInvoiceNumberFrom(["INV-999", "INV-1000"])).toBe("INV-1001");
    expect(nextInvoiceNumberFrom(["INV-1000", "INV-999"])).toBe("INV-1001");
  });

  it("ignores imported numbers that don't follow the INV-nnn shape", () => {
    expect(nextInvoiceNumberFrom(["CLK-88231", "INV-002", "2024/07/A"])).toBe("INV-003");
  });

  it("still returns a first number when nothing matches the shape", () => {
    expect(nextInvoiceNumberFrom(["CLK-1", "FV-2024-1"])).toBe("INV-001");
  });
});

describe("formatDuration", () => {
  it("renders zero-padded hh:mm:ss", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(61)).toBe("00:01:01");
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  it("keeps counting hours past a day instead of wrapping", () => {
    expect(formatDuration(90000)).toBe("25:00:00");
  });
});

describe("invoiceTotals", () => {
  const items = (...amounts: number[]) => amounts.map((amount) => ({ amount }));

  it("adds up exactly: subtotal + tax === total", () => {
    // The regression: this subtotal at 25% gives 2375.58 when tax is rounded
    // and added, but 2375.57 when the grossed-up figure is rounded. The
    // invoice, the PDF and the payment link must agree on one of them.
    const { subtotal, taxAmount, total } = invoiceTotals(items(1900.46), 25);
    expect(subtotal).toBe(1900.46);
    expect(taxAmount).toBe(475.12);
    expect(total).toBe(2375.58);
    expect(roundMoney(subtotal + taxAmount)).toBe(total);
  });

  it("keeps subtotal + tax === total across many rates and amounts", () => {
    for (const rate of [0, 5, 7.5, 19, 20, 21, 23, 25]) {
      for (let cents = 1; cents < 4000; cents += 7) {
        const { subtotal, taxAmount, total } = invoiceTotals(items(cents / 100), rate);
        expect(roundMoney(subtotal + taxAmount)).toBe(total);
      }
    }
  });

  it("never emits more than two decimal places", () => {
    const { subtotal, taxAmount, total } = invoiceTotals(items(33.33, 33.33, 33.34), 19);
    for (const value of [subtotal, taxAmount, total]) {
      expect(Number.isInteger(Math.round(value * 100))).toBe(true);
      expect(value).toBe(roundMoney(value));
    }
  });

  it("treats a zero tax rate as no tax", () => {
    expect(invoiceTotals(items(10, 20), 0)).toEqual({
      subtotal: 30,
      taxAmount: 0,
      total: 30,
    });
  });

  it("handles an empty invoice", () => {
    expect(invoiceTotals([], 20)).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});
