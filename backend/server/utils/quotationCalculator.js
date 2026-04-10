// server/utils/quotationCalculator.js

function round(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function calculateTotals(items = []) {
  let subtotal = 0;
  let total_discount = 0;
  let tax_total = 0;

  const normalizedItems = [];

  for (const it of items) {
    const qty = Number(it.qty || 0);
    const rate = Number(it.unit_price || 0);
    const discPct = Number(it.discount_percent || 0);
    const taxPct = Number(it.tax_rate || 0);

    const gross = qty * rate;
    const discountAmt = gross * discPct / 100;
    const taxable = gross - discountAmt;
    const taxAmt = taxable * taxPct / 100;
    const lineTotal = taxable + taxAmt;

    subtotal += taxable;
    total_discount += discountAmt;
    tax_total += taxAmt;

    normalizedItems.push({
      ...it,
      qty,
      unit_price: rate,
      discount_percent: discPct,
      tax_rate: taxPct,
      taxable_amount: round(taxable),
      tax_amount: round(taxAmt),
      total_amount: round(lineTotal)
    });
  }

  return {
    items: normalizedItems,
    subtotal: round(subtotal),
    total_discount: round(total_discount),
    tax_total: round(tax_total),
    grand_total: round(subtotal + tax_total),
  };
}

module.exports = { calculateTotals };