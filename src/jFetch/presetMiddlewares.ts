import { toCamelCase } from '@edsolater/fnkit'
import { JFetchMiddlewareItem } from './jFetchHandleMiddleware'

/**
 * jFetchMiddleware
 * use camlCase in JS
 */
export const propertyToCamelCase: JFetchMiddlewareItem = {
  parseResponseRaw: (rawText) => rawText.replace(/\w+_[\w_]+(?=["']?:)/g, (text) => toCamelCase(text))
}

/**
 * jFetchMiddleware
 * timeStamp 1973-3-03 ~ 2286-11-21 composed by 9-10 digits in backend
 */
export const secondToMillseconds: (propertyNames: string[] /** backend case  */) => JFetchMiddlewareItem = (
  propertyNames
) => {
  return {
    parseResponseRaw: (rawText) =>
      rawText.replace(
        new RegExp(`["'](${propertyNames.join('|')})["']: ?["']?(\\d{9,10}.?\\d*)["']?`, 'g'),
        (text, propertyName, value) => `${propertyName}: ${Number(value) * 1000}`
      ) // timeStamp 1973-3-03 ~ 2286-11-21 composed by 9-10 digits in backend,
  }
}
