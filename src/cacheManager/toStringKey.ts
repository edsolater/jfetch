import { isArray, isObjectLike, isObjectLiteral, type AnyFn } from "@edsolater/fnkit"

let keyIdCount = 1
const keyIdGen = () => `$${keyIdCount++}`
const generatedKeyMap = new WeakMap<any, string>()

export type ToStringKeyOptions = {
  //difference object can get same key by this option
  getValue?: (value: object | AnyFn, key?: string | number) => unknown
}

// TODO: move to fnkit
export function toStringKey(value: unknown, options?: ToStringKeyOptions): string {
  function innerParseCore(
    value: unknown,
    key: string | number | undefined,
    getValue?: (value: object | AnyFn, key?: string | number) => unknown,
  ): string {
    if (!isObjectLike(value)) return String(value)
    const innerValue = getValue?.(value, key) ?? value
    if (!isObjectLike(innerValue)) return String(innerValue)

    if (generatedKeyMap.has(innerValue)) {
      return generatedKeyMap.get(innerValue)!
    } else {
      if (isArray(innerValue)) {
        const key = `[${innerValue.map((v, idx) => innerParseCore(v, idx, getValue))}]`
        generatedKeyMap.set(innerValue, key)
        return key
      } else if (Object.hasOwn(innerValue, "toString") || Object.hasOwn(innerValue, Symbol.toPrimitive)) {
        const key = String(innerValue)
        generatedKeyMap.set(innerValue, key)
        return key
      } else if (isObjectLiteral(innerValue)) {
        const key = `{${Object.entries(innerValue)
          .map(([k, v]) => `${k}: ${innerParseCore(v, k, getValue)}`)
          .join(";")}}`
        generatedKeyMap.set(innerValue, key)
        return key
      } else {
        const key = keyIdGen()
        generatedKeyMap.set(innerValue, key)
        return key
      }
    }
  }
  return innerParseCore(value, undefined, options?.getValue)
}
