import { isCurrentDateAfter, switchCase, type MayPromise } from "@edsolater/fnkit"
import { type JFetchMiddleware } from "../jFetch"
import { isResponse } from "../utils/isResponse"
import {
  createIDBStoreManager,
  createLocalStorageStoreManager,
  createMemoryStoreManager,
  createSessionStorageStoreManager,
} from "../cacheManager"

type ResourceUrl = string

export type JFetchMiddlewareCacheOptions = {
  /** if still within cache fresh time, use cache. */
  cacheFreshTime?: number // (default: ms)
  cacheFreshTimeUnit?: "ms" | "s" | "m" | "h" | "d" | "w" | "M" | "y"
  cacheStorePlace?:
    | "jsMemory"
    | "localStorage" /* can't used in worker_threads */
    | "sessionStorage" /* can't used in worker_threads */
    | "indexedDB"
}

/** handle raw response */
export function middlewareCache(options: JFetchMiddlewareCacheOptions): JFetchMiddleware {
  return async ({ url }, next) => {
    const { cacheFreshTime = 1000, cacheStorePlace = "indexedDB" } = options
    // const { originalOptions } = userParams
    const key = url satisfies ResourceUrl
    const shouldUseCache = await canUseCache({
      key,
      cacheFreshDuraction: options?.cacheFreshTime ?? 1000,
      unit: options?.cacheFreshTimeUnit ?? "ms",
      storePlace: cacheStorePlace,
    })
    if (shouldUseCache) {
      const cachedResponse = (await getRecordedResponse({ key, storePlace: cacheStorePlace }))!
      return cachedResponse
    } else {
      const response = await next()
      if (isResponse(response) && response.ok) {
        recordResponse({ key, response, shelfLife: cacheFreshTime, storePlace: cacheStorePlace })
      }
      return response
    }
  }
}

interface JFetchCacheItem {
  /*
   * read .text() multi time will throw error, try to use rawText instead
   */
  responseBody?: ArrayBuffer // when it comes from localStorage, response is not exist
  /** use `new Headers()` to parse this */
  responseInit?: ResponseInit
  ok?: boolean
  /** if undefined, it is always go through cache */
  expireAt?: number // milliseconds
}

const getResponseCache = (storePlace: "jsMemory" | "localStorage" | "sessionStorage" | "indexedDB") => {
  if (storePlace === "localStorage" && globalThis.localStorage == null)
    throw new Error("localStorage is not available in this environment")
  if (storePlace === "sessionStorage" && globalThis.sessionStorage == null)
    throw new Error("sessionStorage is not available in this environment")
  if (storePlace === "indexedDB" && !("indexedDB" in globalThis))
    throw new Error("indexedDB is not available in this environment")
  switch (storePlace) {
    case "jsMemory":
      return createMemoryStoreManager<JFetchCacheItem>()
    case "localStorage":
      return createLocalStorageStoreManager<JFetchCacheItem>()
    case "sessionStorage":
      return createSessionStorageStoreManager<JFetchCacheItem>()
    case "indexedDB":
      return createIDBStoreManager<JFetchCacheItem>({ dbName: "jFetch", storeName: "cache" })
  }
}

/**
 * io-task: store the response content to use next time
 */
async function recordResponse(config: {
  key: string
  response: MayPromise<Response>
  shelfLife: number /* unit:s */
  storePlace: "jsMemory" | "localStorage" | "sessionStorage" | "indexedDB"
}) {
  const { key, response } = config
  return Promise.resolve(response).then((res) => {
    if (res.ok) {
      res
        .clone()
        .arrayBuffer()
        .then((buffer) => {
          // cach core
          getResponseCache(config.storePlace).set(key, {
            responseBody: buffer,
            responseInit: {
              headers: Array.from(res.headers.entries()),
              status: res.status,
              statusText: res.statusText,
            },
            ok: true,
            expireAt: Date.now() + config.shelfLife,
          })
        })
    }
    return res
  })
}
/**
 * io-task: get the response content from last time of {@link recordResponse}
 */
async function getRecordedResponse(config: {
  key: string
  storePlace: "jsMemory" | "localStorage" | "sessionStorage" | "indexedDB"
}): Promise<Response | undefined> {
  const { key } = config
  const responseCache = getResponseCache(config.storePlace)
  const cacheItem = await responseCache.get(key)
  if (cacheItem == null) return
  if (cacheItem.expireAt != null && isCurrentDateAfter(cacheItem.expireAt * 1000)) {
    responseCache.delete(key)
    return
  }
  return new Response(cacheItem.responseBody, cacheItem.responseInit)
}

async function canUseCache(config: {
  key: string
  cacheFreshDuraction: number
  unit: "ms" | "s" | "m" | "h" | "d" | "w" | "M" | "y"
  storePlace: "jsMemory" | "localStorage" | "sessionStorage" | "indexedDB"
}) {
  const durationMS = switchCase(config.unit, {
    ms: config.cacheFreshDuraction,
    s: config.cacheFreshDuraction * 1000,
    m: config.cacheFreshDuraction * 1000 * 60,
    h: config.cacheFreshDuraction * 1000 * 60 * 60,
    d: config.cacheFreshDuraction * 1000 * 60 * 60 * 24,
    w: config.cacheFreshDuraction * 1000 * 60 * 60 * 24 * 7,
    M: config.cacheFreshDuraction * 1000 * 60 * 60 * 24 * 30,
    y: config.cacheFreshDuraction * 1000 * 60 * 60 * 24 * 365,
  })
  const responseCache = getResponseCache(config.storePlace)
  const hasCached = await responseCache.has(config.key)
  const isCacheFresh =
    config.cacheFreshDuraction != null
      ? Math.abs(Date.now() - ((await responseCache.get(config.key))?.expireAt ?? 0)) < durationMS
      : true
  return hasCached && isCacheFresh
}
