import { shrinkToValue, isExist, isNullish } from "@edsolater/fnkit"

export function setLocalStorageItem<T = any>(
  key: string,
  dispatcher: ((prev: T | undefined) => T) | T,
  options?: {
    /**
     * if a middleware return undefined, whole action crash.
     */
    middlewares?: ((prev: T | undefined) => T | undefined)[]
  }
) {
  const prev = getLocalStorageItem<T>(key)
  const newValue = shrinkToValue(dispatcher, [prev])
  const parsedValue = (options?.middlewares ?? []).reduce(
    (previouslyParsedValue, middleware) =>
      isExist(previouslyParsedValue) ? middleware(previouslyParsedValue) : previouslyParsedValue,
    newValue as T | undefined
  )
  if (isNullish(parsedValue)) return
  globalThis.localStorage?.setItem(key, JSON.stringify(newValue))
}

export function getLocalStorageItem<T = any>(
  key: string,
  options?: {
    /**
     * if a middleware return undefined, whole action crash.
     */
    middlewares?: ((prev: T | undefined) => T | undefined)[]
  }
): T | undefined {
  const storedValue = globalThis.localStorage?.getItem(key)
  const newValue = isExist(storedValue) ? JSON.parse(storedValue) : undefined
  const parsedValue = (options?.middlewares ?? []).reduce(
    (previouslyParsedValue, middleware) =>
      isExist(previouslyParsedValue) ? middleware(previouslyParsedValue) : previouslyParsedValue,
    newValue as T | undefined
  )
  return parsedValue
}