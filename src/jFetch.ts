import { addDefaultProperties, isString, shakeNil } from "@edsolater/fnkit"
import { middlewareCache, type JFetchMiddlewareCacheOptions } from "./middlewares/cache"
import { requestPendingCache } from "./middlewares/cacheTempPendingRequest"
import { jsonify } from "./middlewares/jsonifyTheResponse"

export type JFetchResponseItem = any

export type JFetchMiddleware = (
  ctx: { url: string; userParams?: { originalOptions?: RequestInit } },
  next: () => Promise<JFetchResponseItem>,
) => Promise<JFetchResponseItem>

export interface JFetchMiddlewareOptions {
  /**
   * waterflow:
   * 1. invoke first item, then second, then third, ... , the last one
   * 2. fetch core
   * 3. run the last one, then the second last one, ... , the first one
   *
   * order:
   * midlewares >>>  build in middlewares >>>
   * lowest method(fetch core)
   * build in middlewares(after next) >>>  midlewares(afterNext)
   *
   * final stack:
   * - user middlewares (in(code before next))
   * --- build in middlewares (in(code before next))
   * ----- lowest method(fetch core)
   * --- build in middlewares (out(code after next))
   * - user middlewares (out(code after next))
   */
  middlewares?: (JFetchMiddleware | undefined)[]

  /**
   * by default, it will parse response to json
   * it will simply just mute middleware:jsonify
   */
  isJSONResponse?: boolean
}

export interface JFetchOption extends JFetchMiddlewareOptions, JFetchMiddlewareCacheOptions {
  originalOptions?: RequestInit
  onFetchSuccess?: (payload: { rawResponse: Response }) => void
}

/** currently just a type function */
export function createJFetchMiddleware(rawFn: JFetchMiddleware): JFetchMiddleware {
  return rawFn
}

/**
 * @todo fetcher core should also be a middleware
 * @todo if too large, cache in indexedDB instead of memory
 */
export async function jFetch<Shape = any>(input: RequestInfo, rawoptions?: JFetchOption): Promise<Shape | undefined> {
  const options = addDefaultProperties(rawoptions ?? {}, { isJSONResponse: true })
  // lowest (with basic callback)
  const fetcherCore = () =>
    fetch(input, options?.originalOptions).then((res) => {
      options?.onFetchSuccess?.({ rawResponse: res })
      return res
    })

  // parse middlewares
  const isJSONResponse = options?.isJSONResponse ?? true
  const parsedMiddlewares = (options?.middlewares ?? []).concat([
    isJSONResponse ? jsonify : undefined,
    requestPendingCache,
  ])

  const urlKey = isString(input) ? input : input.url

  const mergedCoreFn = shakeNil(parsedMiddlewares).reduceRight(
    (prev: () => Promise<any>, current) => async () => current({ userParams: options, url: urlKey }, prev),
    fetcherCore,
  )

  return mergedCoreFn() as Promise<Shape | undefined>
}
