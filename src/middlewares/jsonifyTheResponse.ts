import { JFetchMiddleware } from "../jFetch"
import { isResponse } from "../utils/isResponse"

export function middlewareJsonifyTheResponse(): JFetchMiddleware {
  // console.log('static parse middlewareJsonifyTheResponse')
  return async ({ url }, next) => {
    // console.log('run middlewareJsonifyTheResponse before next')
    const response = await next()
    // console.log('run middlewareJsonifyTheResponse after next')
    if (isResponse(response)) return response.json()
    else return response
  }
}
