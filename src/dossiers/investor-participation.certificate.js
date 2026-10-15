// Generated from the independently pinned investor evidence contract; regenerate with scripts/investor-client-certificate.mjs.
export const investorCertificate=Object.freeze({
  "schemaVersion": 1,
  "qualityVersion": "148755dc316f0c2d04bf5abf",
  "contractSha256": "3334756091feaee0404f6c32da0d2a2e316b4ea18f21e2824c3d65aa5a385a1f",
  "coverage": {
    "total": 7657,
    "reviewed": 3,
    "pending": 7654,
    "bundles": 42
  },
  "facts": {
    "net": "investor-monthly-categories-2026-inr-crore|8966f35dc7a8cfaa0125",
    "aaum": "investor-monthly-categories-2026-inr-crore|3e27339c52a83574d6e7",
    "aum": "investor-monthly-categories-2026-inr-crore|71c202ab560558e4e0f6"
  },
  "records": Object.freeze({
    "investor-monthly-categories-2026-inr-crore|8966f35dc7a8cfaa0125": {
      "fingerprint": "ad95e224c6b479b8153b191dbcdf30bf52d98da6b902ce8583804a895b032926",
      "policyId": "investor-reviewed-national-monthly-net-flow",
      "policySha256": "b5977087832f2402c0d0cd1a9d26f65b342b7367c008832cd5b479a006e2eb6d",
      "unit": "inr_crore",
      "observationKind": "observed-activity"
    },
    "investor-monthly-categories-2026-inr-crore|3e27339c52a83574d6e7": {
      "fingerprint": "1f6e73b6d019652a6d0f9fe4a9a331266dec622bb7051bc3d9e0751613cb71fd",
      "policyId": "investor-reviewed-national-monthly-average-aum",
      "policySha256": "a959eb764166b308bcc66cbebb75ca54f95ebb716608a63fcdb0403f1e02a9b3",
      "unit": "inr_crore",
      "observationKind": "observed-period-average"
    },
    "investor-monthly-categories-2026-inr-crore|71c202ab560558e4e0f6": {
      "fingerprint": "0b9dcb093cd39199c8ab1ae821dde3fd8a5692e60103e6b4a002c9159235f745",
      "policyId": "investor-reviewed-national-month-end-aum",
      "policySha256": "5dfab73e8b05cd62e4f77ae3cef24fc099e247ee9ec096ecffee3af4b556535f",
      "unit": "inr_crore",
      "observationKind": "observed-stock"
    }
  })
});
Object.freeze(investorCertificate.coverage);Object.freeze(investorCertificate.facts);for(const value of Object.values(investorCertificate.records))Object.freeze(value);
