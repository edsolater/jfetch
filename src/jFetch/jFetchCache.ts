import { isFunction, forEachEntry } from '@edsolater/fnkit'
import { getLocalStorageItem, setLocalStorageItem } from '../utils/localStorage'

type ResourceUrl = string
type JFetchCacheItem = (
  | {
      /**
       * read .text() multi time will throw error, try to use rawText instead
       */
      response?: Promise<Response> // when it comes from localStorage, response is not exist
      rawText: Promise<string | undefined>
      isLoading: true
      state: 'loading' /* common property is easy for type guard */
    }
  | {
      /**
       * read .text() multi time will throw error, try to use rawText instead
       */
      response?: Promise<Response | undefined> // when it comes from localStorage, response is not exist
      rawText?: Promise<string | undefined>
      isResponseError: true
      state: 'error' /* common property is easy for type guard */
    }
  | {
      /**
       * read .text() multi time will throw error, try to use rawText instead
       */
      response?: Promise<Response> // when it comes from localStorage, response is not exist
      rawText: Promise<string>
      isResponseError: false
      isSuccess: true
      state: 'success' /* common property is easy for type guard */
    }
) & {
  paload?: Record<string, any> // POST's payload when fetching
  timeStamp: number
}
type JFetchCacheLocalStorageItem = Omit<JFetchCacheItem, 'response' | 'rawText'> & { rawText: string }

export const resultCache = syncWithLocalStorage(new Map<ResourceUrl, JFetchCacheItem>())

function syncWithLocalStorage(map: Map<ResourceUrl, JFetchCacheItem>) {
  // initly get data from localStorage
  const cache = getLocalStorageItem<Record<string, JFetchCacheLocalStorageItem>>('raydium-controller-jFetch-cache')
  if (cache) {
    forEachEntry(cache, ([key, value]) => {
      map.set(key, { ...value, rawText: Promise.resolve(value.rawText) } as JFetchCacheItem)
    })
  }

  // bind proxied methods
  return new Proxy(map, {
    get(target, propertyKey, receiver) {
      const original = Reflect.get(target, propertyKey, receiver)
      const bindedOriginal = isFunction(original) ? original.bind(target) : original
      if (propertyKey === ('set' as keyof Map<any, any>)) {
        return async (...args) => {
          const [key, cacheItem] = args as [ResourceUrl, JFetchCacheItem]
          const plainRawText = await cacheItem.rawText
          if (!plainRawText) return
          if (cacheItem.state === 'success') {
            setLocalStorageItem<Record<string, JFetchCacheLocalStorageItem>>(
              'raydium-controller-jFetch-cache',
              (s) => ({
                ...s,
                [key]: { ...cacheItem, rawText: plainRawText, response: null }
              })
            )
          }
          return bindedOriginal(...args)
        }
      } else {
        return bindedOriginal
      }
    }
  })
}
