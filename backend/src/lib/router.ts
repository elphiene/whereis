export type Params = Record<string, string>;
export type Handler = (req: Request, params: Params) => Response | Promise<Response>;

interface Route {
  method: string;
  paramNames: string[];
  pattern: RegExp;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  private register(method: string, path: string, handler: Handler) {
    const paramNames: string[] = [];
    const regexStr = path
      .replace(/\//g, '\\/')
      .replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    this.routes.push({
      method,
      paramNames,
      pattern: new RegExp(`^${regexStr}$`),
      handler,
    });
  }

  get(path: string, handler: Handler)    { this.register('GET',    path, handler); }
  post(path: string, handler: Handler)   { this.register('POST',   path, handler); }
  patch(path: string, handler: Handler)  { this.register('PATCH',  path, handler); }
  put(path: string, handler: Handler)    { this.register('PUT',    path, handler); }
  delete(path: string, handler: Handler) { this.register('DELETE', path, handler); }

  async handle(req: Request): Promise<Response> {
    const pathname = new URL(req.url).pathname;
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params: Params = {};
      route.paramNames.forEach((name, i) => { params[name] = match[i + 1]!; });
      return route.handler(req, params);
    }
    return new Response('Not Found', { status: 404 });
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
