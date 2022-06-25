/**
 * this file is a workarount for Error: "React is not defined"
 * used in tsup.config.ts
 * @see https://github.com/egoist/tsup/issues/390#issuecomment-933488738
 */
export { default as React } from 'react'
