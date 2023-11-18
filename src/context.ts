import { Server } from "bun";
import { Handler } from "./types";

export class Context {
  private parsedUrl: URL;
  /**
   * Locals makes it possible to pass any values under keys scoped to the request
   * and therefore available to all following routes that match the request.
   */
  public locals: Local;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _body: any | FormData | string | null = null;

  constructor(
    private server: Server,
    public req: Request,
    public routes: Routes | null = null,
    /**
     * The all path parameters of the request.
     */
    public params: { [key: string]: string } = {},
    public res: Response = new Response()
  ) {
    this.parsedUrl = new URL(req.url);
    this.locals = new Local();
  }

  /**
   * Calls the next handler in the chain.
   *
   */
  public next(): void {
    this.routes!.next();
  }

  /**
   * Returns the value of the specified query parameter.
   *
   * @example
   * ```ts
   *  // route: /test?id=1
   *  const id = ctx.query("id");
   *  console.log(id); // 1
   * ```
   */
  public query(query: string): string | null {
    return this.parsedUrl.searchParams.get(query);
  }

  /**
   * Returns the all query parameters.
   *
   * @example
   * ```ts
   * // route: /test?id=1&name=test
   * const queries = ctx.queries();
   * console.log(queries);
   * // URLSearchParams { 'id' => '1', 'name' => 'test' }
   * ```
   */
  public queries(): URLSearchParams {
    return this.parsedUrl.searchParams;
  }

  /**
   * Returns the client's IP address. By default it will return remote-addr, if ipHeader is specified it will return the value of the specified header.
   *
   * @example
   * ```ts
   *  const remoteAddr = ctx.ip();
   *  const xForwardedFor = ctx.ip("x-forwarded-for");
   *
   * ```
   */
  public ip(ipHeader?: string): string | null {
    if (ipHeader) {
      return this.req.headers.get(ipHeader);
    }

    return this.server.requestIP(this.req)?.address || null;
  }

  /**
   * Returns the value of the specified cookie.
   *
   * @example
   * ```ts
   *  const cookie = ctx.cookie("cookieName");
   *  console.log(cookie);
   * ```
   */
  public cookie(name: string): string | null {
    return (
      // TODO maybe we can set cookies in init and then use this.req.cookies.get(name) for better performance
      this.req.headers
        .get("Cookie")
        ?.split(";")
        .find((c) => c.startsWith(name))
        ?.split("=")[1] || null
    );
  }

  /**
   * Returns the value of the Authorization header.
   *
   * @example
   * ```ts
   *  const authorization = ctx.authorization();
   * ```
   */
  public authorization(): string | null {
    return this.req.headers.get("Authorization");
  }

  /**
   * Returns the value of the specified path parameter.
   *
   * @example
   * ```ts
   * // route: /test/:id => /test/1
   * const id = ctx.param("id");
   * console.log(id); // 1
   * ```
   */
  public param(name: string): string | null {
    return this.params[name] || null;
  }

  /**
   * Returns the parsed body of the request. If the Content-Type is application/json it will return a JSON object, if the Content-Type is application/x-www-form-urlencoded it will return a URLSearchParams object, if the Content-Type is multipart/form-data it will return a FormData object, otherwise it will return a string.
   *
   * @example
   * ```ts
   * const body = await ctx.body();
   * console.log(body);
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async body(): Promise<any | FormData | string | ArrayBuffer> {
    if (this.req.method === "GET" || this.req.method === "HEAD")
      return Promise.resolve(null);

    if (!this.req.body) return Promise.resolve(null);
    if (this._body) return Promise.resolve(this._body);
    let body = null;

    const contentType =
      this.req.headers.get("Content-Type")?.split(";")[0] || "";

    switch (contentType) {
      case "application/json":
        body = await this.req.json();
        this._body = body;
        break;
      case "application/x-www-form-urlencoded":
        body = await this.req.formData();
        this._body = body;
        break;
      case "multipart/form-data":
        body = await this.req.formData();
        this._body = body;
        break;
      case "text/plain":
        body = await this.req.text();
        this._body = body;
        break;
      case "application/octet-stream":
        body = await this.req.arrayBuffer();
        this._body = body;
        break;
    }

    return Promise.resolve(this._body);
  }

  /**
   * Redirects to the specified URL with the specified status code. If the status code is not specified it will default to 302.
   *
   * @example
   * ```ts
   * ctx.redirect("/test-route");
   * ctx.redirect("https://google.com");
   *
   * ```
   */
  public redirect(url: string, status: number = 302): void {
    if (status < 300 || status > 399) {
      throw new Error("Invalid redirect status code");
    }
    let href = url;
    if (!url.startsWith("http")) {
      href = new URL(url, this.req.url).href;
    } else {
      href = url;
    }

    this.res = new Response(null, {
      status,
      headers: {
        location: href,
      },
    });
  }

  /**
   * Sets the status code of the Response object.
   *
   * @example
   * ```ts
   * ctx.status(204);
   * ```
   */
  public status(status: number): Context {
    if (status < 100 || status > 599) {
      throw new Error("Invalid status code");
    }

    this.res = new Response(null, {
      status: status,
      headers: {
        ...this.res.headers.toJSON(),
      },
    });

    return this;
  }

  /**
   * Returns the status code of the Response object.
   *
   * @example
   * ```ts
   * const status = ctx.getStatus();
   * console.log(status);
   * ```
   */
  public getStatus(): number {
    return this.res.status;
  }

  /**
   * Sets the JSON data to the Response object.
   *
   * @example
   * ```ts
   * ctx.json({ data: "Hello World" });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public json(data: any, status?: number): Context {
    // TODO adition control for data
    let jsonData;
    if (typeof data === "string") {
      jsonData = data;
    } else {
      jsonData = JSON.stringify(data);
    }

    this.res = new Response(jsonData, {
      status: status || this.res.status,
      headers: {
        ...this.res.headers.toJSON(),
        "Content-Type": "application/json",
      },
    });

    return this;
  }

  /**
   * Sets the specified header with the specified value to the Response object.
   *
   * @example
   * ```ts
   * ctx.set("x-request-id", "123");
   * ```
   */
  public set(key: string, value: string): void {
    if (!key || !value) return;
    this.res.headers.set(key, value);
  }

  /**
   * Returns the value of the specified header from the Request object.
   *
   * @example
   * ```ts
   * const xRequestId = ctx.get("x-request-id");
   * console.log(xRequestId);
   * ```
   */
  public get(key: string): string | null {
    return this.req.headers.get(key);
  }

  /**
   * Returns the value of the specified header from the Response object.
   *
   * @example
   * ```ts
   * const xCorrelationId = ctx.getResHeader("x-correlation-id");
   * console.log(xCorrelationId);
   */
  public getResHeader(key: string): string | null {
    return this.res.headers.get(key);
  }

  public getResWithoutBody(): Response {
    return new Response(null, {
      status: this.res.status,
      headers: this.res.headers,
    });
  }

  // save file
  // TODO
  // params ??
  // baseUrl ?? => req.url
}

class Local {
  /**
   * Creates a new Local object.
   */
  // TODO: weakmap
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private locals = new Map<string, any>()) {}

  /**
   * Returns the value of the specified local variable.
   * @example
   * ```ts
   * const localValue = ctx.locals.get("local_value");
   * console.log(localValue);
   * ```
   */
  public get<T>(key: string): T | undefined {
    return this.locals.get(key);
  }

  /**
   * Sets the value of the specified local variable.
   * @example
   * ```ts
   * ctx.locals.set("local_value", "test");
   * ```
   */
  public set<T>(key: string, value: T): void {
    this.locals.set(key, value);
  }

  /**
   * Returns true if the specified local variable exists.
   * @example
   * ```ts
   * const hasLocalValue = ctx.locals.has("local_value");
   * console.log(hasLocalValue);
   */
  public has(key: string): boolean {
    return this.locals.has(key);
  }
}

export class Routes {
  constructor(public handlers: Handler[], public handlerIndex: number = 0) {}

  public next(): void {
    this.handlerIndex++;
  }

  public hasNext(): boolean {
    return this.handlerIndex < this.length;
  }

  public currentHandler(): Handler {
    return this.handlers[this.handlerIndex];
  }

  public reset(): void {
    this.handlerIndex = 0;
  }

  public get length(): number {
    return this.handlers.length;
  }

  public get currentIndex(): number {
    return this.handlerIndex;
  }
}