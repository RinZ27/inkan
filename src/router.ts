// A segment tree. Static segments win over `:params`, params win over `*rest`,
// so `/users/me` and `/users/:id` can live side by side in any order.

type Node<R> = {
  statics: Map<string, Node<R>>;
  param?: { name: string; node: Node<R> };
  wildcard?: { name: string; routes: Map<string, R> };
  routes: Map<string, R>;
};

const node = <R>(): Node<R> => ({ statics: new Map(), routes: new Map() });

export type Match<R> =
  | { kind: "found"; route: R; params: Record<string, string> }
  | { kind: "method"; allow: string[] }
  | { kind: "none" };

export function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export class Router<R> {
  private root: Node<R> = node();

  add(method: string, path: string, route: R) {
    let n = this.root;
    const segments = splitPath(path);
    for (const [i, seg] of segments.entries()) {
      if (seg.startsWith("*")) {
        if (i !== segments.length - 1) throw new Error(`A wildcard has to be the last segment: ${path}`);
        n.wildcard ??= { name: seg.slice(1) || "rest", routes: new Map() };
        this.put(n.wildcard.routes, method, path, route);
        return;
      }
      if (seg.startsWith(":")) {
        const name = seg.slice(1);
        if (n.param && n.param.name !== name) {
          throw new Error(`${path} names a parameter :${name} where another route already has :${n.param.name}`);
        }
        n.param ??= { name, node: node() };
        n = n.param.node;
      } else {
        let next = n.statics.get(seg);
        if (!next) n.statics.set(seg, (next = node()));
        n = next;
      }
    }
    this.put(n.routes, method, path, route);
  }

  private put(routes: Map<string, R>, method: string, path: string, route: R) {
    if (routes.has(method)) throw new Error(`${method} ${path} is defined twice`);
    routes.set(method, route);
  }

  match(method: string, path: string): Match<R> {
    let segments: string[];
    try {
      segments = splitPath(path).map(decodeURIComponent);
    } catch {
      return { kind: "none" };
    }
    const hit = this.walk(this.root, segments, 0, {});
    if (!hit) return { kind: "none" };
    const route = hit.routes.get(method) ?? (method === "HEAD" ? hit.routes.get("GET") : undefined);
    if (route) return { kind: "found", route, params: hit.params };
    const allow = [...hit.routes.keys()];
    if (allow.includes("GET")) allow.push("HEAD");
    return { kind: "method", allow };
  }

  private walk(
    n: Node<R>,
    segs: string[],
    i: number,
    params: Record<string, string>,
  ): { routes: Map<string, R>; params: Record<string, string> } | undefined {
    if (i === segs.length) {
      if (n.routes.size) return { routes: n.routes, params };
      if (n.wildcard) return { routes: n.wildcard.routes, params: { ...params, [n.wildcard.name]: "" } };
      return undefined;
    }
    const s = n.statics.get(segs[i]);
    if (s) {
      const hit = this.walk(s, segs, i + 1, params);
      if (hit) return hit;
    }
    if (n.param) {
      const hit = this.walk(n.param.node, segs, i + 1, { ...params, [n.param.name]: segs[i] });
      if (hit) return hit;
    }
    if (n.wildcard) return { routes: n.wildcard.routes, params: { ...params, [n.wildcard.name]: segs.slice(i).join("/") } };
    return undefined;
  }
}
