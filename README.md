<picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vxnsin/inkan/main/assets/wordmark-dark.svg"><img src="https://raw.githubusercontent.com/vxnsin/inkan/main/assets/wordmark-light.svg" alt="inkan" width="340"></picture>

**An API server for Node where the docs can't lie.**

[![npm](https://img.shields.io/npm/v/inkan?color=c4381f&labelColor=2b2420&label=npm)](https://www.npmjs.com/package/inkan)
[![CI](https://img.shields.io/github/actions/workflow/status/vxnsin/inkan/ci.yml?branch=main&color=3d7a4b&labelColor=2b2420&label=ci)](https://github.com/vxnsin/inkan/actions/workflows/ci.yml)
[![dependencies](https://img.shields.io/badge/dependencies-0-ece1cf?labelColor=2b2420)](package.json)
[![License](https://img.shields.io/badge/license-MIT-a87fe0?labelColor=2b2420)](LICENSE)
[![supports warden](https://raw.githubusercontent.com/vxnsin/warden/main/assets/supports-warden.svg)](https://github.com/vxnsin/warden)

<!-- cozy:cards -->
<!-- /cozy:cards -->

An *inkan* (印鑑) is the seal a Japanese contract gets stamped with. Here every
route carries one: params, query, body, responses and a few examples, written
once. From that one definition inkan checks what comes in, types your handler,
checks what goes out, writes OpenAPI 3.1, serves the docs, and runs every
example as a test.

```ts
import { inkan, problem, t } from "inkan";

const Tea = t.object({ id: t.int(), name: t.string(), kind: t.enum(["green", "black", "oolong"]) });
const teas = [{ id: 1, name: "Sencha", kind: "green" as const }];

const app = inkan({ title: "Tea Shop", version: "1.0.0" });

app.get(
  "/teas/:id",
  {
    params: t.object({ id: t.int() }),
    response: { 200: Tea, 404: t.problem() },
    examples: [
      { name: "found", params: { id: 1 }, expect: { name: "Sencha" } },
      { name: "missing", params: { id: 99 }, status: 404 },
    ],
  },
  ({ params }) => {
    const tea = teas.find((x) => x.id === params.id); // params.id is a number, not a string
    if (!tea) throw problem(404, "tea-not-found", `There is no tea with id ${params.id}`);
    return tea; // has to be a Tea, or it does not compile
  },
);

app.listen();
```

The examples are what the docs show, and they are what this runs. Say the 404 got lost in a refactor:

```sh
$ npx inkan check src/app.ts

  印 inkan check  ·  Tea Shop 1.0.0

  GET    /teas/:id
    ✓ found                              200  0.8ms
    ✗ missing                            200  0.4ms
        answered 200, expected 404

  2 examples · 1 sealed · 1 broken
```

A docs page that is tested is a docs page you can trust. When the handler
drifts, the check goes red before anyone reads something false.

## Why another one

Express gets out of the way, FastAPI writes your docs. inkan wants both, plus
the one thing neither does: holding the server to what its docs say.

| | Express | Fastify | FastAPI | inkan |
| --- | :-: | :-: | :-: | :-: |
| Handler types come from the schema | – | with a type provider | ✓ | ✓ |
| OpenAPI document | plugin | plugin | ✓ | ✓ |
| Docs page | plugin | plugin | ✓ | ✓ no CDN, works offline |
| Answers trimmed to the contract | – | ✓ | ✓ | ✓ and checked in dev |
| **Examples run as tests** | – | – | – | ✓ `inkan check` |
| **Live request inspector** | – | – | – | ✓ `/_inkan` |
| Every error in one shape ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)) | – | – | – | ✓ |
| Runtime dependencies | several | several | several | **none** |

## Install

```sh
npm install inkan
```

Node 20 or newer. On Node 22.18 and newer, `.ts` files run as they are,
with no build step and no loader.

## What it does

| | |
| --- | --- |
| **Checks what comes in** | `params`, `query`, `headers` and `body` are validated together. Path and query strings become the numbers and booleans the schema asks for. Bad input is one 400 that lists every issue, not just the first. |
| **Types the handler** | No generics to write. `params.id` is what the schema says, and so is the return value. Without a schema, `:id` in the path is still typed. |
| **Checks what goes out** | In development, an answer that breaks its contract is a 500 that says where, not a silent surprise for the frontend. Keys the contract does not list are dropped, so a `passwordHash` never leaves by accident. |
| **Writes OpenAPI 3.1** | At `/openapi.json`, from the same schemas. Named schemas land in `components` once. |
| **Serves the docs** | At `/docs`. Every example has a send button, and a route gets its seal 印 when all of its examples answer as promised. |
| **Runs examples as tests** | `inkan check` or `app.check()`, in-process, no port. Routes without examples are listed, so nothing hides. |
| **Shows what happened** | `/_inkan` is a live log of the last 200 requests and what broke the contract. Development only, loopback only, secret headers hidden. |
| **Errors in one shape** | `throw problem(404, "tea-not-found", "…")` gives an RFC 9457 document. Every built-in error has the same shape, with a stable `type` to switch on. |

## A route

```ts
app.post(
  "/teas",
  {
    summary: "Add a tea",
    tags: ["teas"],
    body: NewTea,
    response: { 201: Tea, 409: t.problem() },
    examples: [
      { name: "a new oolong", body: { name: "Da Hong Pao", kind: "oolong" }, expect: { id: 2 } },
      { name: "no name", body: { kind: "green" }, status: 400 },
    ],
  },
  ({ body, reply }) => {
    const tea = store.add(body);
    return reply(201, tea, { location: `/teas/${tea.id}` });
  },
);
```

| field | |
| --- | --- |
| `params`, `query`, `headers`, `body` | schemas for the input. Header names are lowercase. |
| `response` | status → schema. The first 2xx is the default status, and no body means 204. |
| `examples` | `{ name, params, query, headers, body, status, expect }`. `status` defaults to the first 2xx. `expect` is a part of the answer that has to be there. |
| `summary`, `description`, `tags`, `deprecated`, `operationId` | for the docs |
| `hidden` | keeps the route out of the docs and OpenAPI |
| `use` | middleware for this route only, after validation |

A handler returns a value, or `reply(status, body, headers)` for anything
else. `ctx.reply` is typed to the statuses in the contract, so `reply(418)`
on a route that never promised a teapot does not compile.

## Schemas

```ts
t.string().min(1).max(60).email().uuid().pattern(/x/).format("date-time").trim()
t.int().min(0)   t.number().positive()   t.boolean()
t.enum(["a", "b"])   t.literal("a")   t.union(t.string(), t.int())
t.array(Tea).min(1)   t.record(t.int())   t.any()   t.empty()   t.problem()
t.object({ … }).strict() .passthrough() .pick() .omit() .extend() .partial()

.optional()  .nullable()  .default(v)  .describe("…")  .example(v)  .named("Tea")  .deprecated()
```

`Infer<typeof Tea>` is the TypeScript type. `Tea.parse(x)` throws a
`ValidationError`, `Tea.safeParse(x)` does not, and `Tea.toJSONSchema()`
gives JSON Schema 2020-12.

## Examples are tests

```sh
npx inkan check src/app.ts            # every route
npx inkan check src/app.ts --only /teas
npx inkan check src/app.ts --json     # for CI
```

The entry file exports the app (`export default app` or `export const app`).
`app.listen()` stays quiet while the CLI loads it. If the examples change data,
export a `beforeEach` that puts it back. It runs before every example:

```ts
export function beforeEach() {
  store.reset();
}
```

Or inside your own tests:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { app, beforeEach } from "./app.ts";

test("the contract holds", async () => {
  const report = await app.check({ beforeEach });
  assert.equal(report.failed, 0);
});
```

For everything the examples do not cover, `app.inject()` sends a request
straight in, without a socket:

```ts
const res = await app.inject({ method: "POST", url: "/teas", body: { name: "Gyokuro" } });
res.status; // 400
res.body.errors; // [{ in: "body", path: "kind", message: "is required" }, …]
```

## Middleware and groups

```ts
app.use(async (ctx, next) => {
  const started = Date.now();
  await next();
  ctx.header("server-timing", `app;dur=${Date.now() - started}`);
});

const admin = routes().use(requireAdmin).get("/stats", () => stats());
app.mount("/admin", admin);
```

`ctx.state` carries things from middleware to the handler. A thrown
`problem()` stops everything, wherever it is thrown.

## Running it

`app.listen()` takes the port from its argument, then `$PORT`, then 3000. So it
runs under [warden](https://github.com/vxnsin/warden), a container or a PaaS
without changes:

```sh
warden run -- node src/app.ts
```

On SIGINT or SIGTERM it lets open requests finish (up to ten seconds) before it
exits. `app.listener` is a plain `(req, res)` function for your own
`http.createServer`.

```ts
inkan({
  title: "Tea Shop", version: "1.0.0", description: "…", servers: [{ url: "https://api.example.com" }],
  docs: "/docs",                  // or false
  openapi: "/openapi.json",       // or false
  inspector: "/_inkan",           // default: on in development, always loopback only
  validateResponses: true,        // default: on in development
  bodyLimit: 1024 * 1024,
  log: true,                      // one line per request, default: on in development
  gracefulShutdown: true,
  dev: process.env.NODE_ENV !== "production",
  onError: (err, ctx) => report(err),
});
```

## CLI

```sh
npx inkan check   src/app.ts [--only <text>] [--json]
npx inkan openapi src/app.ts [-o openapi.json]
npx inkan routes  src/app.ts
```

## Try the example

```sh
git clone https://github.com/vxnsin/inkan && cd inkan && npm install
node examples/shop.ts              # then open http://localhost:3000/docs
node src/cli.ts check examples/shop.ts
```

## Not yet

- a typed client that reads the routes, with no codegen
- CORS and `OPTIONS` out of the box
- streaming answers and file uploads
- routes from the file tree

Ideas and issues are welcome.

## License

[MIT](LICENSE)
