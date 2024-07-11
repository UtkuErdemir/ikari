import { FunctionTarget } from "..";
import { HTTPMethod, createPath } from "../utils";

/**
 * Decorator for defining a route that handles OPTIONS requests
 *
 * @param path - The path to the route (optional). By default it will use the name of the function.
 *
 **/
export function Options(path?: string) {
  return function (target: FunctionTarget, key: string) {
    if (!target) return;
    if (!target[key]) return;
    if (typeof target[key] !== "function")
      throw new Error("Options decorator can only be used on functions");

    const routePath = path ? createPath(path) : createPath(key);
    Reflect.defineMetadata("path", routePath, target, key);
    Reflect.defineMetadata("method", HTTPMethod.OPTIONS, target, key);
  };
}
