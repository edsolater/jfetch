import { type AnyFn, type MayPromise } from "@edsolater/fnkit"
import { createIDBStoreManager } from "./storageManagers"
import { toStringKey, type ToStringKeyOptions } from "./toStringKey"

type CacheEntry<F extends AnyFn> = [
  string | number,
  ReturnType<F> extends Promise<any> ? ReturnType<F> : Promise<ReturnType<F>>,
]

export function createConfigableCachedFn<F extends AnyFn>(
  fn: F,
  options: {
    /** if set this, it will not get key by {@link toStringKey}  */
    toCacheKey?: (...params: Parameters<F>) => string | number
    /** else will set this  */
    toStringKeyOptions?: ToStringKeyOptions

    outsideCache?: {
      onResult?: (key: string | number, value: ReturnType<F>) => void
      checkFromOutsideCache: (key: string | number) => boolean | Promise<boolean>
      getFromOutsideCache: (key: string | number) => ReturnType<F> | Promise<ReturnType<F>>
      /** sometimes need inject data from outsideCache */
      initCachedValues?: CacheEntry<F>[]
    }
  },
): {
  cachedFn: (...params: Parameters<F>) => ReturnType<F> extends Promise<infer T> ? Promise<T> : Promise<ReturnType<F>>
  utils: {
    injectCacheValue(entry: CacheEntry<F>): void
  }
} {
  // to faster set cache in memory
  const fastMemoryCache = new Map<string | number, MayPromise<CacheEntry<F>[1]>>()

  if (options.outsideCache?.initCachedValues) {
    options.outsideCache.initCachedValues.forEach(injectCacheValue)
  }

  function injectCacheValue(entry: CacheEntry<F>) {
    const [key, value] = entry

    fastMemoryCache.set(key, value)
  }

  async function cachedFn(...params: Parameters<F>) {
    const paramsKey = options.toCacheKey?.(...params) ?? toStringKey(params, options.toStringKeyOptions)
    if (fastMemoryCache.has(paramsKey)) {
      return fastMemoryCache.get(paramsKey)
    } else {
      const { promise, resolve, reject } = Promise.withResolvers()
      fastMemoryCache.set(paramsKey, promise as any)
      if (await options.outsideCache?.checkFromOutsideCache?.(paramsKey)) {
        const value = options.outsideCache!.getFromOutsideCache(paramsKey)
        fastMemoryCache.set(paramsKey, value as any)
        resolve(value)
      } else {
        try {
          const result = fn(...params)
          options.outsideCache?.onResult?.(paramsKey, result)
          resolve(result)
        } catch (e) {
          reject(e)
        }
      }
      return promise
    }
  }

  return { cachedFn: cachedFn as any, utils: { injectCacheValue } }
}

/**
 * with indexedDB
 * @param fn original function
 * @param options
 * @returns
 */
export function createIDBCachedFn<F extends AnyFn>(
  fn: F,
  options: {
    dbName: string
    dbStoreName?: string
    dbVersion?: number

    /** only useful if not set option:toCacheKey */
    toStringKeyOptions?: ToStringKeyOptions

    /** turn object(with methods) to structuredClonable object  */
    toDBValue?(value: ReturnType<F>): any | Promise<any>

    /** reverse version of {@link structuredClonify} */
    fromDBValue?(value: any): ReturnType<F>

    /** if set this, it will not get key by {@link toStringKey}  */
    toCacheKey?(...params: Parameters<F>): string | number
  },
) {
  const storeManager = createIDBStoreManager({
    dbName: options.dbName,
    storeName: options.dbStoreName,
    version: options.dbVersion,
    onStoreLoaded: async (store) => {
      store.forEach((value, key) => {
        const memoryStorableValue = (options.fromDBValue?.(value) ?? value) as any
        utils.injectCacheValue([key as string | number, memoryStorableValue])
      })
    },
  })
  const { cachedFn, utils } = createConfigableCachedFn(fn, {
    toCacheKey: options.toCacheKey,
    toStringKeyOptions: options.toStringKeyOptions,
    outsideCache: {
      onResult(key, value) {
        storeManager.set(key, options.toDBValue?.(value) ?? value)
      },
      checkFromOutsideCache: (key) => storeManager.has(key),
      getFromOutsideCache: (key) => storeManager.get(key).then((v) => options.fromDBValue?.(v) ?? v) as any,
    },
  })
  return cachedFn
}
