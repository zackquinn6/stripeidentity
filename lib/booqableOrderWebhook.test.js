import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coerceBooqableWebhookBody,
  identityWebhookEventEligible,
  parseBooqableOrderWebhook,
  webhookPayloadOrderStatus,
} from "./booqableOrderWebhook.js";

describe("parseBooqableOrderWebhook", () => {
  it("parses Zapier-style wrapped body", () => {
    const body = {
      order: {
        id: "11111111-1111-4111-8111-111111111111",
        customer_id: "22222222-2222-4222-8222-222222222222",
      },
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "wrapped");
    assert.equal(p?.orderId, body.order.id);
    assert.equal(p?.customerId, body.order.customer_id);
  });

  it("parses native v4 order webhook with relationships.customer", () => {
    const body = {
      event: "order.reserved",
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        type: "orders",
        relationships: {
          customer: { data: { id: "44444444-4444-4444-8444-444444444444" } },
        },
      },
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "native");
    assert.equal(p?.event, "order.reserved");
    assert.equal(p?.orderId, body.data.id);
    assert.equal(p?.customerId, "44444444-4444-4444-8444-444444444444");
  });

  it("parses JSON:API order document without top-level event", () => {
    const body = {
      data: {
        type: "orders",
        id: "55555555-5555-4555-8555-555555555555",
        attributes: { status: "reserved" },
        relationships: {
          customer: { data: { id: "66666666-6666-4666-8666-666666666666" } },
        },
      },
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "jsonapi_order");
    assert.equal(p?.orderId, body.data.id);
    assert.equal(p?.customerId, "66666666-6666-4666-8666-666666666666");
  });

  it("parses primary data array with order resource", () => {
    const body = {
      event: "order.updated",
      data: [
        { type: "orders", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        { type: "customers", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      ],
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "native");
    assert.equal(p?.orderId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(p?.customerId, null);
  });

  it("parses JSON:API order without embedded customer", () => {
    const body = {
      data: {
        type: "orders",
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        attributes: { status: "reserved" },
      },
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "jsonapi_order");
    assert.equal(p?.customerId, null);
  });

  it("parses primary data array without event when included has single customer", () => {
    const body = {
      data: [{ type: "orders", id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }],
      included: [
        { type: "customers", id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", attributes: {} },
      ],
    };
    const p = parseBooqableOrderWebhook(body);
    assert.equal(p?.kind, "jsonapi_order");
    assert.equal(p?.customerId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("returns null for unrelated payloads", () => {
    assert.equal(parseBooqableOrderWebhook({}), null);
    assert.equal(parseBooqableOrderWebhook({ event: "customer.created", data: {} }), null);
  });
});

describe("identityWebhookEventEligible", () => {
  it("allows wrapped bodies", () => {
    const parsed = {
      kind: "wrapped",
      event: null,
      orderId: "a",
      customerId: "b",
    };
    assert.equal(identityWebhookEventEligible(parsed, {}), true);
  });

  it("allows order.reserved", () => {
    const body = {
      event: "order.reserved",
      data: { id: "o1", relationships: { customer: { data: { id: "c1" } } } },
    };
    const parsed = parseBooqableOrderWebhook(body);
    assert(parsed);
    assert.equal(identityWebhookEventEligible(parsed, body), true);
  });

  it("allows order.saved_as_draft (handler GET-gates reserved before identity)", () => {
    const body = {
      event: "order.saved_as_draft",
      data: { id: "o1", relationships: { customer: { data: { id: "c1" } } } },
    };
    const parsed = parseBooqableOrderWebhook(body);
    assert(parsed);
    assert.equal(identityWebhookEventEligible(parsed, body), true);
  });

  it("allows order.updated for handler-side GET gating", () => {
    const body = {
      event: "order.updated",
      data: { id: "o1", relationships: { customer: { data: { id: "c1" } } } },
    };
    const parsed = parseBooqableOrderWebhook(body);
    assert(parsed);
    assert.equal(identityWebhookEventEligible(parsed, body), true);
  });

  it("allows jsonapi_order without event (handler GET-gates reserved)", () => {
    const draft = {
      data: {
        type: "orders",
        id: "o2",
        attributes: { status: "draft" },
        relationships: { customer: { data: { id: "c1" } } },
      },
    };
    const p = parseBooqableOrderWebhook(draft);
    assert(p);
    assert.equal(identityWebhookEventEligible(p, draft), true);
  });
});

describe("coerceBooqableWebhookBody", () => {
  it("parses JSON string body", () => {
    const inner = { event: "order.updated", data: { id: "o1" } };
    const req = {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inner),
    };
    const out = coerceBooqableWebhookBody(req);
    assert.deepEqual(out, inner);
  });

  it("parses application/x-www-form-urlencoded JSON in payload field", () => {
    const inner = { event: "order.reserved", data: { id: "o2", customer_id: "c2" } };
    const encoded = `payload=${encodeURIComponent(JSON.stringify(inner))}`;
    const req = {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: encoded,
    };
    const out = coerceBooqableWebhookBody(req);
    assert.deepEqual(out, inner);
  });
});

describe("webhookPayloadOrderStatus", () => {
  it("reads status from attributes", () => {
    assert.equal(
      webhookPayloadOrderStatus({ attributes: { status: "Reserved" } }),
      "reserved"
    );
  });
});
