import { HttpMethod, createPath } from "../utils";

/**
 * Decorator for defining a route that handles POST requests
 *
 * @param path - The path to the route (optional). By default it will use the name of the function.
 *
 **/

export function Post(path?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, key: string) {
    if (!target) return;
    if (!target[key]) return;
    if (typeof target[key] !== "function")
      throw new Error("Post decorator can only be used on functions");
    const routePath = path ? createPath(path) : createPath(key);
    Reflect.defineMetadata("path", routePath, target, key);
    Reflect.defineMetadata("method", HttpMethod.POST, target, key);
  };
}
