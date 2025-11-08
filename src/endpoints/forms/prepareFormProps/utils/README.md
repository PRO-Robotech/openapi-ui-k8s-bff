1. Getting `swaggerPaths` from cache

2. Checking `isNamespaced` and getting `swaggerPath`

3. Getting OpenAPI schema by `swaggerPath` to `swaggerPathValue`

4. Safely getting `bodyParametersSchema` and `kind` from OpenAPI schema

5. Getting `specificCustomOverrides` by `customizationId`

6. Overriding `bodyParametersSchema.properties` with `specificCustomOverrides.spec.schema` with strategy specified in `specificCustomOverrides.spec.strategy`. Getting `mergedProperties` & `mergedRequired`

7. Getting `pathsWithAdditionalProperties` from `bodyParametersSchema`

8. Getting `propertiesToMerge` from `pathsWithAdditionalProperties` & `prefillValuesSchema` & `mergedProperties`. PrefillValuesSchema is JSON of an object

9. `newProperties` = deepMerge(`mergedProperties`, `propertiesToMerge`)

10. Getting `autoPersistedFromAP` by `pathsWithAdditionalProperties` and `prefillValuesSchema`. PrefillValuesSchema is JSON of an object

11. Getting `hiddenPaths`, `expandedPaths`, `persistedPaths`, `sortPaths` from `specificCustomOverrides`

12. Merging and getting unique:

- `uniqPersisted` = `persistedPaths` + `autoPersistedFromAP`
- `uniqExpanded` = `expandedPaths` + `autoPersistedFromAP`
