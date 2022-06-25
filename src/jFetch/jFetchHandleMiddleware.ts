import { asyncReduce, getTime, MayPromise, shakeNil, tryCatch, areShallowEqual } from '@edsolater/fnkit'
import { jFetchCoreWithCache, JFetchCoreOptions } from './jFetchCoreWithCache'

export type JFetchMiddlewareItem = {
  /** usually it's for data rename  */
  parseResponseRaw?: (rawText: string) => MayPromise<string>
  /** usually it's for data reshape  */
  parseResponseJson?: (data: any) => MayPromise<any>
}

export type JFetchOptions = {
  middlewares?: JFetchMiddlewareItem[]
} & JFetchCoreOptions

type JFetchResultCache = Map<
  string,
  {
    rawText: string
    timeStamp: number
    options?: JFetchOptions | undefined
    result?: unknown
  }
>

const finalResultCache: JFetchResultCache = new Map()
function storeInResultCache(
  input: RequestInfo,
  rawText: string,
  options: JFetchOptions | undefined,
  formattedData: any
) {
  const key = typeof input === 'string' ? input : input.url
  finalResultCache.set(key, {
    rawText,
    timeStamp: getTime(),
    options,
    result: formattedData
  })
}
function getCachedSuitableResult(input: RequestInfo, rawText: string, options: JFetchOptions | undefined) {
  const key = typeof input === 'string' ? input : input.url
  if (finalResultCache.has(key)) {
    const cached = finalResultCache.get(key)!
    if (rawText == cached?.rawText && options?.middlewares?.length === cached?.options?.middlewares?.length) {
      return cached.result
    }
  }
}

/**
 * same interface as original fetch, but, customized version have cache
 */
export default async function jFetch<Shape = any>(
  input: RequestInfo,
  options?: JFetchOptions
): Promise<Shape | undefined> {
  const rawText = await jFetchCoreWithCache(input, options)

  if (!rawText) return undefined
  /* ----------see if cache have result to avoid return same content but different object */
  const cached = getCachedSuitableResult(input, rawText, options)
  if (cached) return cached as Shape
  const renamedText = await asyncReduce(
    shakeNil(options?.middlewares?.map((m) => m.parseResponseRaw) ?? []),
    (rawText, parseResponseRaw) => parseResponseRaw(rawText),
    rawText
  )
  if (!renamedText) return undefined
  try {
    const rawJson = tryCatch(
      () => JSON.parse(renamedText || '{}'),
      () => tryCatch(() => new Function('return ' + renamedText)(), undefined)
    )
    const formattedData = await asyncReduce(
      shakeNil(options?.middlewares?.map((m) => m.parseResponseJson) ?? []),
      (rawJson, parseResponseJson) => parseResponseJson(rawJson),
      rawJson
    )

    storeInResultCache(input, rawText, options, formattedData)
    return formattedData
  } catch (err) {
    console.error(err)
    return undefined
  }
}
