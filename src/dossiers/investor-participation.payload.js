// Escape HTML script delimiters without changing any source string after JSON.parse.
export function serializeInvestorPayload(payload){return JSON.stringify(payload).replace(/</g,'\\u003c');}
