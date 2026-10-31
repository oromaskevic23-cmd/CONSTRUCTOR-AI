export function invoiceTotalCents(items) {
  if (!Array.isArray(items)) throw new TypeError;
  let total = 0;
  for (const item of items) {
    if (typeof item !== 'object' || item === null || !('qty' in item) || !('unitCents' in item)) throw new TypeError;
    const { qty, unitCents } = item;
    if (typeof qty !== 'number' || typeof unitCents !== 'number' || !Number.isSafeInteger(qty) || !Number.isSafeInteger(unitCents)) throw new TypeError;
    if (qty < 1 || unitCents < 0) throw new RangeError;
    const product = qty * unitCents;
    if (!Number.isSafeInteger(product)) throw new RangeError;
    total += product;
    if (!Number.isSafeInteger(total)) throw new RangeError;
  }
  return total;
}