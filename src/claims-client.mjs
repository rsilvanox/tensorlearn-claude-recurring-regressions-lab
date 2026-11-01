import { normalizeCustomerCode } from './customer-code.mjs';
export function createClaimsClient(fetchClaim, {now=Date.now, ttlMs=30000} = {}) {
  const cache=new Map();
  async function get(customerCode) {
    const code=normalizeCustomerCode(customerCode);
    const prior=cache.get(code);
    if (prior && now()-prior.at < ttlMs) return prior.value;
    const value=await fetchClaim(code);
    cache.set(code,{at:now(),value});
    return value;
  }
  // Current status plus the normalized schema v3 reference. Goes through the
  // same 30-second per-customer cache as get(). Caller enforces owner authorization.
  async function getStatus(customerCode) {
    const code=normalizeCustomerCode(customerCode);
    return {customerCode:code, status:await get(code)};
  }
  return {get, getStatus};
}
