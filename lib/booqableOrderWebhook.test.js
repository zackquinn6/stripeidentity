import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("rejects order.saved_as_draft (not a committed reservation)", () => {
    const body = {
      event: "order.saved_as_draft",
      data: { id: "o1", relationships: { customer: { data: { id: "c1" } } } },
    };
    const parsed = parseBooqableOrderWebhook(body);
    assert(parsed);
    assert.equal(identityWebhookEventEligible(parsed, body), false);
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

  it("allows jsonapi_order without event only when payload status is reserved", () => {
    const reserved = {
      data: {
        type: "orders",
        id: "o1",
        attributes: { status: "reserved" },
        relationships: { customer: { data: { id: "c1" } } },
      },
    };
    const p1 = parseBooqableOrderWebhook(reserved);
    assert(p1);
    assert.equal(identityWebhookEventEligible(p1, reserved), true);

    const draft = {
      data: {
        type: "orders",
        id: "o2",
        attributes: { status: "draft" },
        relationships: { customer: { data: { id: "c1" } } },
      },
    };
    const p2 = parseBooqableOrderWebhook(draft);
    assert(p2);
    assert.equal(identityWebhookEventEligible(p2, draft), false);
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
