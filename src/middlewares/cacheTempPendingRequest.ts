import { JFetchResponseItem, JFetchMiddlewareFn } from "../jFetch"

// store for on-going request to avoid duplicated request very fast.(100 times in 1ms)
const tempPendingRequest = new Map<string, Promise<JFetchResponseItem>>()
function hasTempPendingRequest(url: string) {
  return tempPendingRequest.has(url)
}
function getTempPendingRequest(url: string) {
  return tempPendingRequest.get(url)
}
/**
 * use {@link tempPendingRequest} to store on-going request
 * @param url key
 * @returns methods to load response(when loaded, it will be removed from {@link tempPendingRequest} also)
 */
function createTempPendingRequest(url: string) {
  let loadTempPendingRequest: (res: Promise<JFetchResponseItem>) => void = () => {} // Initialize the variable
  const tempPendingRequestPromise = new Promise<JFetchResponseItem>((resolve, reject) => {
    loadTempPendingRequest = (res) => {
      res
        .then((res) => {
          resolve(res)
          tempPendingRequest.delete(url)
        })
        .catch((e) => {
          reject(e)
        })
        .finally(() => {
          tempPendingRequest.delete(url)
        })
    }
  })
  tempPendingRequest.set(url, tempPendingRequestPromise)
  return { loadTempPendingRequest }
}
export function middlewareUseTempPendingRequest(): JFetchMiddlewareFn {
  return async ({ url }, next) => {
    if (hasTempPendingRequest(url)) {
      return getTempPendingRequest(url)?.then((res) => res?.clone())
    }
    const { loadTempPendingRequest } = createTempPendingRequest(url)
    const responsePromise = next()
    loadTempPendingRequest(responsePromise)
    return responsePromise
  }
}
