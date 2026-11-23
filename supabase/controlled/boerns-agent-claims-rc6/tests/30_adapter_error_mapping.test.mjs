import assert from "node:assert/strict";
import test from "node:test";

import {
  mapDatabaseError,
  mapTransportError,
} from "../adapter/error_mapping.mjs";

test("authentication and authorization remain distinct", () => {
  assert.deepEqual(mapDatabaseError({ code: "BC002" }), {
    status: 401,
    body: { code: "INVALID_IDENTITY" },
  });
  assert.deepEqual(mapDatabaseError({ code: "BC008" }), {
    status: 403,
    body: { code: "FORBIDDEN" },
  });
});

test("known foreign and unknown claim responses share the 404 class", () => {
  assert.deepEqual(mapDatabaseError({ code: "BC003" }), {
    status: 404,
    body: { code: "CLAIM_NOT_FOUND" },
  });
});

test("unknown SQLSTATE and ACL errors fail closed", () => {
  for (const code of ["42501", "XX000", "08006", "ZZ999", undefined]) {
    assert.deepEqual(mapDatabaseError({ code, message: "must not leak" }), {
      status: 503,
      body: { code: "CLAIM_STATUS_UNKNOWN" },
    });
  }
});

test("driver, timeout, malformed response, and transport failures fail closed", () => {
  for (const error of [new Error("driver"), null, { timeout: true }, { row: "bad" }]) {
    assert.deepEqual(mapTransportError(error), {
      status: 503,
      body: { code: "CLAIM_STATUS_UNKNOWN" },
    });
  }
});
