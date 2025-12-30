import _ from 'lodash'
import { getPropertiesToMerge } from './getPropertiesToMerge'

describe('getPropertiesToMerge', () => {
  it('returns empty object when prefillValuesSchema is missing', () => {
    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['spec']],
      prefillValuesSchema: undefined,
      mergedProperties: {},
    })

    expect(result).toEqual({})
  })

  it('skips when valueUnderPath is not a plain object (e.g. array)', () => {
    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['spec']],
      prefillValuesSchema: { spec: [] },
      mergedProperties: {
        spec: { type: 'object', additionalProperties: true, properties: {} },
      },
    })

    expect(result).toEqual({})
  })

  it('creates schema nodes for truly additional keys using value-based inference when no ap schema object is provided', () => {
    const prefillValuesSchema = {
      spec: {
        foo: 'bar',
        count: 7,
        enabled: true,
        list: ['a', 'b'],
        emptyList: [],
        obj: { a: 1 },
      },
    }

    const mergedProperties = {
      spec: {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
    }

    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['spec']],
      prefillValuesSchema,
      mergedProperties,
    })

    expect(_.get(result, ['spec', 'properties', 'foo'])).toMatchObject({
      type: 'string',
      default: 'bar',
      isAdditionalProperties: true,
    })

    expect(_.get(result, ['spec', 'properties', 'count'])).toMatchObject({
      type: 'number',
      default: 7,
      isAdditionalProperties: true,
    })

    expect(_.get(result, ['spec', 'properties', 'enabled'])).toMatchObject({
      type: 'boolean',
      default: true,
      isAdditionalProperties: true,
    })

    expect(_.get(result, ['spec', 'properties', 'list'])).toMatchObject({
      type: 'array',
      default: ['a', 'b'],
      isAdditionalProperties: true,
      items: { type: 'string' },
    })

    // Empty array -> defaults to string item type
    expect(_.get(result, ['spec', 'properties', 'emptyList'])).toMatchObject({
      type: 'array',
      default: [],
      isAdditionalProperties: true,
      items: { type: 'string' },
    })

    expect(_.get(result, ['spec', 'properties', 'obj'])).toMatchObject({
      type: 'object',
      default: { a: 1 },
      isAdditionalProperties: true,
      properties: {},
    })
  })

  it('does not generate schema for keys that already exist in the parent schema', () => {
    const prefillValuesSchema = {
      spec: {
        sshKeys: ['k1', 'k2'], // should be skipped
        extra: 'hello', // should be added
      },
    }

    const mergedProperties = {
      spec: {
        type: 'object',
        additionalProperties: true,
        properties: {
          sshKeys: { type: 'array', items: { type: 'string' } },
        },
      },
    }

    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['spec']],
      prefillValuesSchema,
      mergedProperties,
    })

    expect(_.get(result, ['spec', 'properties', 'sshKeys'])).toBeUndefined()

    expect(_.get(result, ['spec', 'properties', 'extra'])).toMatchObject({
      type: 'string',
      default: 'hello',
      isAdditionalProperties: true,
    })
  })

  it('prefers parent additionalProperties schema object (supports custom types like multilineString)', () => {
    const prefillValuesSchema = {
      data: {
        'admin.enabled': 'true',
        'application.instanceLabelKey': 'argocd.argoproj.io/instance',
      },
    }

    const mergedProperties = {
      data: {
        type: 'object',
        additionalProperties: {
          type: 'multilineString',
          description: 'Data value',
        },
        properties: {},
      },
    }

    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['data']],
      prefillValuesSchema,
      mergedProperties,
    })

    expect(_.get(result, ['data', 'properties', 'admin.enabled'])).toMatchObject({
      type: 'multilineString',
      description: 'Data value',
      default: 'true',
      isAdditionalProperties: true,
    })

    expect(_.get(result, ['data', 'properties', 'application.instanceLabelKey'])).toMatchObject({
      type: 'multilineString',
      description: 'Data value',
      default: 'argocd.argoproj.io/instance',
      isAdditionalProperties: true,
    })
  })

  it('clones the parent additionalProperties schema object (does not mutate or share references)', () => {
    const prefillValuesSchema = {
      data: { 'admin.enabled': 'true' },
    }

    const mergedProperties = {
      data: {
        type: 'object',
        additionalProperties: {
          type: 'multilineString',
          description: 'Original description',
        },
        properties: {},
      },
    }

    const parentApSchemaRef = mergedProperties.data.additionalProperties

    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['data']],
      prefillValuesSchema,
      mergedProperties,
    })

    const node = _.get(result, ['data', 'properties', 'admin.enabled'])
    expect(node).toBeDefined()

    // Mutate returned node
    if (node) {
      node.description = 'Changed in result'
    }

    // Ensure parent template is unchanged
    expect(parentApSchemaRef).toMatchObject({
      type: 'multilineString',
      description: 'Original description',
    })
  })

  it('supports multiple additionalProperties paths', () => {
    const prefillValuesSchema = {
      spec: { extraSpec: 'x' },
      data: { k: 'v' },
    }

    const mergedProperties = {
      spec: {
        type: 'object',
        additionalProperties: true,
        properties: {},
      },
      data: {
        type: 'object',
        additionalProperties: { type: 'multilineString' },
        properties: {},
      },
    }

    const result = getPropertiesToMerge({
      pathsWithAdditionalProperties: [['spec'], ['data']],
      prefillValuesSchema,
      mergedProperties,
    })

    expect(_.get(result, ['spec', 'properties', 'extraSpec'])).toMatchObject({
      type: 'string',
      default: 'x',
      isAdditionalProperties: true,
    })

    expect(_.get(result, ['data', 'properties', 'k'])).toMatchObject({
      type: 'multilineString',
      default: 'v',
      isAdditionalProperties: true,
    })
  })
})
