import { MayPromise } from '@edsolater/fnkit'
import { resultCache } from './jFetchCache'

export type JFetchCoreOptions = RequestInit & {
  /** if still within cache fresh time, use cache. */
  cacheMaxAcceptDuraction?: number
}
const defaultCacheFreshTime = 1000 // 1 second

async function isRequestSuccess(res: MayPromise<Response>) {
  const clonedRes = (await res).clone()
  if (!clonedRes.ok) return false
  try {
    const dataText = await clonedRes.text()
    const mathed = dataText.match(/\"success\":\s?false/)
    if (mathed) return false
    return true
  } catch {
    return false
  }
}

function canJFetchUseCache({ key, cacheFreshDuraction }: { key: string; cacheFreshDuraction?: number }) {
  const hasCached = resultCache.get(key) != null
  const isCacheFresh =
    cacheFreshDuraction != null ? Date.now() - (resultCache.get(key)?.timeStamp ?? 0) < cacheFreshDuraction : true
  return hasCached && isCacheFresh
}

/**
 * same interface as original fetch, but, customized version have cache
 */
export async function jFetchCoreWithCache(
  input: RequestInfo,
  options?: JFetchCoreOptions
): Promise<string | undefined> {
  const key = typeof input === 'string' ? input : input.url

  const shouldUseCache = canJFetchUseCache({
    key,
    cacheFreshDuraction: options?.cacheMaxAcceptDuraction ?? defaultCacheFreshTime
  })

  if (shouldUseCache) return resultCache.get(key)!.rawText

  try {
    const response = fetch(input, options)
    const rawText = response
      .then((r) => r.clone())
      .then(async (res) => {
        const requestIsSuccess = await isRequestSuccess(res)
        if (requestIsSuccess) {
          return res.text()
        } else {
          resultCache.delete(key)
          return ''
        }
      })
      .catch(() => {
        return ''
        // throw new Error('response .text() error')
      })
    const tempJFetchItem = {
      response,
      rawText,
      timeStamp: Date.now(),
      isLoading: true,
      state: 'loading'
    } as const
    resultCache.set(key, tempJFetchItem)

    // error
    if (!(await isRequestSuccess(response))) {
      const jFetchItem = {
        response,
        rawText,
        timeStamp: Date.now(),
        isResponseError: true,
        state: 'error'
      } as const
      resultCache.set(key, jFetchItem)
      return canJFetchUseCache({ key }) && resultCache.get(key)!.state === 'success'
        ? resultCache.get(key)!.rawText
        : undefined
    } else {
      const jFetchItem = {
        response,
        rawText,
        timeStamp: Date.now(),
        isResponseError: false,
        isSuccess: true,
        state: 'success'
      } as const
      resultCache.set(key, jFetchItem)
      return rawText
    }
  } catch {
    const jFetchItem = {
      response: Promise.resolve(undefined),
      timeStamp: Date.now(),
      isResponseError: true,
      state: 'error'
    } as const
    resultCache.set(key, jFetchItem)
    return undefined
  }
}
