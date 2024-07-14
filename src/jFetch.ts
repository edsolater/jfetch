import { isString } from "@edsolater/fnkit"
import { middlewareCache, type JFetchMiddlewareCacheOptions } from "./middlewares/cache"
import { middlewareUseTempPendingRequest } from "./middlewares/cacheTempPendingRequest"
import { middlewareJsonifyTheResponse } from "./middlewares/jsonifyTheResponse"

export type JFetchResponseItem = Response | undefined

export type JFetchMiddlewareFn = (
  ctx: { url: string; userParams?: { originalOption?: RequestInit } },
  next: () => Promise<JFetchResponseItem>,
) => Promise<JFetchResponseItem>

export interface JFetchMiddlewareOptions {
  /**
   * first parse first item, then second, then third, ... , the last one, fetch core
   * order: high -> low
   * final stack: user middlewares-> build in middlewares -> lowest method(fetch core)
   * final stack:
   * - user middlewares (in)
   * --- build in middlewares (in)
   * ----- lowest method(fetch core)
   * --- build in middlewares (out)
   * - user middlewares (out)
   */
  middlewares?: JFetchMiddlewareFn[]
}

export interface JFetchOption extends JFetchMiddlewareOptions, JFetchMiddlewareCacheOptions {
  originalOption?: RequestInit
}

/**
 * @todo fetcher core should also be a middleware
 * @todo if too large, cache in indexedDB instead of memory
 */
export async function jFetch<Shape = any>(input: RequestInfo, options?: JFetchOption): Promise<Shape | undefined> {
  const url = isString(input) ? input : input.url
  const fetcherCore = () => fetch(input, options?.originalOption)
  const buildinMiddlewares = [
    middlewareJsonifyTheResponse(),
    middlewareUseTempPendingRequest(),
    middlewareCache(options ?? {}),
  ]
  const middlewares = (options?.middlewares ?? []).concat(buildinMiddlewares)
  const getResponse = middlewares.reduceRight(
    (prev: () => Promise<any>, current) => async () => current({ userParams: options, url: url }, prev),
    fetcherCore,
  )

  return getResponse() as Promise<Shape | undefined>
}
