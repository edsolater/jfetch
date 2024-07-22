import { JFetchMiddleware } from "../jFetch"
import { isResponse } from "../utils/isResponse"

/**
 * jfetch middleware: parse response to json
 */
export const jsonify: JFetchMiddleware = async ({ url }, next) => {
  // console.log('run middlewareJsonifyTheResponse before next')
  const response = await next()
  // console.log('run middlewareJsonifyTheResponse after next')
  if (isResponse(response)) return response.json()
  else return response
}
