import { test } from "node:test";
import assert from "node:assert/strict";
import { t, ValidationError } from "../src/index.ts";

test("objects keep known keys, drop unknown ones and report every issue", () => {
  const User = t.object({ name: t.string().min(2), age: t.int().min(0), email: t.string().email().optional() });
  assert.deepEqual(User.parse({ name: "Mio", age: 3, extra: true }), { name: "Mio", age: 3 });
  const r = User.safeParse({ name: "M", age: -1, email: "nope" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.deepEqual(
      r.issues.map((i) => i.path),
      ["name", "age", "email"],
    );
  }
});

test("missing fields are required unless optional or defaulted", () => {
  const S = t.object({ a: t.string(), b: t.string().optional(), c: t.int().default(5) });
  assert.deepEqual(S.parse({ a: "x" }), { a: "x", c: 5 });
  assert.throws(() => S.parse({}), ValidationError);
});

test("coercion turns query strings into numbers, booleans and lists", () => {
  const Q = t.object({ n: t.int(), on: t.boolean(), tags: t.array(t.string()) });
  assert.deepEqual(Q.parse({ n: "42", on: "true", tags: "a" }, { coerce: true }), { n: 42, on: true, tags: ["a"] });
  assert.equal(Q.safeParse({ n: "4.2", on: "x", tags: [] }, { coerce: true }).ok, false);
  assert.equal(t.int().safeParse("42").ok, false, "no coercion without asking for it");
});

test("enums, literals, unions, records and nullables", () => {
  assert.equal(t.enum(["a", "b"]).parse("b"), "b");
  assert.equal(t.enum(["a", "b"]).safeParse("c").ok, false);
  assert.equal(t.literal(1).parse(1), 1);
  assert.equal(t.union(t.string(), t.int()).parse(3), 3);
  assert.deepEqual(t.record(t.int()).parse({ a: 1 }), { a: 1 });
  assert.equal(t.string().nullable().parse(null), null);
});

test("strict objects refuse unknown keys", () => {
  const r = t.object({ a: t.int() }).strict().safeParse({ a: 1, b: 2 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.issues[0].path, "b");
});

test("pick, omit, extend and partial build new shapes", () => {
  const Base = t.object({ id: t.int(), name: t.string(), note: t.string() });
  assert.deepEqual(Object.keys(Base.pick("id").shape), ["id"]);
  assert.deepEqual(Object.keys(Base.omit("id").shape), ["name", "note"]);
  assert.deepEqual(Object.keys(Base.extend({ more: t.boolean() }).shape), ["id", "name", "note", "more"]);
  assert.deepEqual(Base.partial().parse({}), {});
});

test("JSON Schema output", () => {
  const S = t.object({
    id: t.int().min(1),
    tags: t.array(t.string()).optional(),
    kind: t.enum(["x", "y"]).default("x"),
    when: t.string().format("date-time").nullable(),
  });
  assert.deepEqual(S.toJSONSchema(), {
    type: "object",
    properties: {
      id: { type: "integer", minimum: 1 },
      tags: { type: "array", items: { type: "string" } },
      kind: { enum: ["x", "y"], default: "x" },
      when: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
    },
    required: ["id", "when"],
  });
});

test("modifiers return copies and never change the original", () => {
  const base = t.string();
  base.min(3).optional();
  assert.equal(base.safeParse("a").ok, true);
  assert.equal(base.safeParse(undefined).ok, false);
});
