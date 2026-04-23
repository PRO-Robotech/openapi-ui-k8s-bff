import { isPathNullable, removeEmptyFormValues } from './removeAndRename'

describe('isPathNullable', () => {
  it('returns false when properties is missing', () => {
    expect(isPathNullable(['spec', 'foo'], undefined)).toBe(false)
  })

  it('returns false for empty path', () => {
    expect(isPathNullable([], { foo: { type: 'string', nullable: true } })).toBe(false)
  })

  it('detects nullable at the top level', () => {
    const properties = {
      schedule: { type: 'string', nullable: true },
      image: { type: 'string' },
    }

    expect(isPathNullable(['schedule'], properties)).toBe(true)
    expect(isPathNullable(['image'], properties)).toBe(false)
  })

  it('detects nullable at a nested object path', () => {
    const properties = {
      spec: {
        type: 'object',
        properties: {
          backup: {
            type: 'object',
            properties: {
              schedule: { type: 'string', nullable: true },
              target: { type: 'string' },
            },
          },
        },
      },
    }

    expect(isPathNullable(['spec', 'backup', 'schedule'], properties)).toBe(true)
    expect(isPathNullable(['spec', 'backup', 'target'], properties)).toBe(false)
  })

  it('descends through array items for numeric path segments', () => {
    const properties = {
      spec: {
        type: 'object',
        properties: {
          containers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                command: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    }

    expect(isPathNullable(['spec', 'containers', 0, 'command'], properties)).toBe(true)
    expect(isPathNullable(['spec', 'containers', 2, 'command'], properties)).toBe(true)
  })

  it('returns false when the path cannot be resolved', () => {
    const properties = { spec: { type: 'object' } }
    expect(isPathNullable(['spec', 'missing'], properties)).toBe(false)
  })
})

describe('removeEmptyFormValues with nullable', () => {
  it('drops null values when schema is not nullable', () => {
    const properties = { image: { type: 'string' } }

    expect(removeEmptyFormValues({ image: null }, [], properties)).toBeUndefined()
  })

  it('preserves null for nullable leaf paths', () => {
    const properties = {
      schedule: { type: 'string', nullable: true },
      image: { type: 'string' },
    }
    const input = { schedule: null, image: null }

    expect(removeEmptyFormValues(input, [], properties)).toEqual({ schedule: null })
  })

  it('preserves null at nested nullable paths', () => {
    const properties = {
      spec: {
        type: 'object',
        properties: {
          backup: {
            type: 'object',
            properties: {
              schedule: { type: 'string', nullable: true },
            },
          },
        },
      },
    }
    const input = { spec: { backup: { schedule: null } } }

    expect(removeEmptyFormValues(input, [], properties)).toEqual({
      spec: { backup: { schedule: null } },
    })
  })

  it('still preserves null via persisted path even when schema is not nullable', () => {
    const properties = { image: { type: 'string' } }
    const input = { image: null }

    expect(removeEmptyFormValues(input, [['image']], properties)).toEqual({ image: null })
  })

  it('does not preserve undefined even when path is nullable (undefined ≠ null)', () => {
    const properties = { schedule: { type: 'string', nullable: true } }

    expect(removeEmptyFormValues({ schedule: undefined }, [], properties)).toBeUndefined()
  })

  it('keeps backwards-compatible behaviour when properties is omitted', () => {
    const input = { image: null, replicas: 3 }

    expect(removeEmptyFormValues(input, [])).toEqual({ replicas: 3 })
  })
})
