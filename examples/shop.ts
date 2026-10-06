// A tiny tea shop. Run it with `node examples/shop.ts`, open /docs,
// or check it with `node src/cli.ts check examples/shop.ts`.

import { inkan, problem, routes, t, type Infer } from "../src/index.ts";

const Kind = t.enum(["green", "black", "oolong", "white", "herbal"]);

const Tea = t
  .object({
    id: t.int().example(1),
    name: t.string().min(1).max(60).example("Sencha"),
    kind: Kind,
    grams: t.int().min(1).describe("Grams per pack"),
    price: t.number().min(0).describe("Euro per pack"),
    inStock: t.boolean(),
  })
  .named("Tea");

const NewTea = Tea.omit("id").named("NewTea");

let teas: Infer<typeof Tea>[] = [];
let nextId = 1;

/** `inkan check` calls this before every example, so each one starts from the same shelf. */
export function beforeEach() {
  nextId = 1;
  teas = [
    { id: nextId++, name: "Sencha", kind: "green", grams: 100, price: 9.5, inStock: true },
    { id: nextId++, name: "Earl Grey", kind: "black", grams: 100, price: 7, inStock: true },
    { id: nextId++, name: "Tie Guan Yin", kind: "oolong", grams: 50, price: 12, inStock: false },
  ];
}
beforeEach();

const tea = routes();

tea.get(
  "/",
  {
    summary: "List teas",
    tags: ["teas"],
    query: t.object({
      kind: Kind.optional(),
      inStock: t.boolean().optional().describe("Only what can ship today"),
      limit: t.int().min(1).max(100).default(20),
    }),
    response: { 200: t.array(Tea) },
    examples: [
      { name: "everything", expect: [{ name: "Sencha" }, { name: "Earl Grey" }, { name: "Tie Guan Yin" }] },
      { name: "only green", query: { kind: "green" }, expect: [{ name: "Sencha" }] },
      { name: "a kind that does not exist", query: { kind: "coffee" }, status: 400 },
    ],
  },
  ({ query }) =>
    teas
      .filter((x) => (query.kind ? x.kind === query.kind : true))
      .filter((x) => (query.inStock === undefined ? true : x.inStock === query.inStock))
      .slice(0, query.limit),
);

tea.get(
  "/:id",
  {
    summary: "Get one tea",
    tags: ["teas"],
    params: t.object({ id: t.int().min(1) }),
    response: { 200: Tea, 404: t.problem() },
    examples: [
      { name: "found", params: { id: 1 }, expect: { name: "Sencha" } },
      { name: "missing", params: { id: 99 }, status: 404 },
      { name: "not a number", params: { id: "abc" }, status: 400 },
    ],
  },
  ({ params }) => {
    const found = teas.find((x) => x.id === params.id); // params.id is a number here, not a string
    if (!found) throw problem(404, "tea-not-found", `There is no tea with id ${params.id}`);
    return found;
  },
);

tea.post(
  "/",
  {
    summary: "Add a tea",
    tags: ["teas"],
    body: NewTea,
    response: { 201: Tea },
    examples: [
      {
        name: "a new oolong",
        body: { name: "Da Hong Pao", kind: "oolong", grams: 50, price: 14, inStock: true },
        expect: { id: 4, name: "Da Hong Pao" },
      },
      { name: "price below zero", body: { name: "Free tea", kind: "green", grams: 10, price: -1, inStock: true }, status: 400 },
    ],
  },
  ({ body, reply }) => {
    const created = { id: nextId++, ...body };
    teas.push(created);
    return reply(201, created, { location: `/teas/${created.id}` });
  },
);

tea.delete(
  "/:id",
  {
    summary: "Remove a tea",
    tags: ["teas"],
    params: t.object({ id: t.int() }),
    response: { 204: t.empty(), 404: t.problem() },
    examples: [
      { name: "removes it", params: { id: 2 }, status: 204 },
      { name: "already gone", params: { id: 99 }, status: 404 },
    ],
  },
  ({ params }) => {
    const i = teas.findIndex((x) => x.id === params.id);
    if (i < 0) throw problem(404, "tea-not-found", `There is no tea with id ${params.id}`);
    teas.splice(i, 1);
  },
);

export const app = inkan({
  title: "Tea Shop",
  version: "1.0.0",
  description: "A small example API. Every example on this page is also a test.",
});

app.use(async (ctx, next) => {
  await next();
  ctx.header("x-served-by", "inkan");
});

app.get(
  "/health",
  { summary: "Is it up?", response: { 200: t.object({ ok: t.boolean() }) }, examples: [{ name: "up" }] },
  () => ({ ok: true }),
);
app.mount("/teas", tea);

app.listen();
