/* eslint-disable no-prototype-builtins */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-syntax */
type ObjectWithKeys = Record<string, any>

export const overwriteMatchingKeys = (obj1: ObjectWithKeys, obj2: ObjectWithKeys): ObjectWithKeys => {
  const result: ObjectWithKeys = { ...obj1 }

  for (const key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      // Check if the key exists in obj1
      if (result.hasOwnProperty(key)) {
        // Overwrite the value from obj2, regardless of whether it's an object or not
        result[key] = obj2[key]
      }
    }
  }

  return result
}
