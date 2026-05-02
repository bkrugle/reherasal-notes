'use strict'

/**
 * Input validation tests for dual-backend support:
 * - Google Sheets (current): CSV/formula injection protection
 * - DocumentDB (future): NoSQL injection protection
 */

// We'll test the validation module once implemented
// For now, these tests define the expected behavior

describe('Input Validation', () => {
  // Placeholder for the module - tests will fail until implementation
  let validation

  beforeAll(() => {
    try {
      validation = require('../_validation')
    } catch (e) {
      // Module doesn't exist yet - tests will fail as expected
      validation = null
    }
  })

  describe('sanitizeForSheets - CSV/Formula injection protection', () => {
    const dangerousChars = ['=', '+', '-', '@']

    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.sanitizeForSheets).toBe('function')
    })

    test.each(dangerousChars)('should escape leading %s character', (char) => {
      const input = `${char}DANGEROUS_FORMULA()`
      const result = validation.sanitizeForSheets(input)
      // Should prefix with single quote to neutralize formula
      expect(result).not.toMatch(new RegExp(`^\\${char}`))
      expect(result).toMatch(/^'/)
    })

    test('should not modify safe strings', () => {
      const safe = ['Hello World', 'John Doe', 'Act 1, Scene 2', 'Notes: Great performance!']
      safe.forEach(input => {
        expect(validation.sanitizeForSheets(input)).toBe(input)
      })
    })

    test('should handle strings with formula chars in middle (safe)', () => {
      const inputs = ['2+2=4', 'email@example.com', 'A-OK', '+1 later in text']
      // Only leading formula chars are dangerous
      expect(validation.sanitizeForSheets('2+2=4')).toBe('2+2=4')
      expect(validation.sanitizeForSheets('user@email.com')).toBe('user@email.com')
    })

    test('should escape tab characters', () => {
      const input = 'Name\tRole'
      const result = validation.sanitizeForSheets(input)
      expect(result).not.toContain('\t')
    })

    test('should escape carriage return characters', () => {
      const input = 'Line1\r\nLine2'
      const result = validation.sanitizeForSheets(input)
      expect(result).not.toContain('\r')
    })

    test('should handle null/undefined gracefully', () => {
      expect(validation.sanitizeForSheets(null)).toBe('')
      expect(validation.sanitizeForSheets(undefined)).toBe('')
    })

    test('should convert non-strings to strings', () => {
      expect(validation.sanitizeForSheets(123)).toBe('123')
      expect(validation.sanitizeForSheets(true)).toBe('true')
    })

    test('should handle empty string', () => {
      expect(validation.sanitizeForSheets('')).toBe('')
    })
  })

  describe('sanitizeForDocDB - NoSQL injection protection', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.sanitizeForDocDB).toBe('function')
    })

    test('should reject strings starting with $ operator', () => {
      const malicious = ['$gt', '$ne', '$where', '$regex']
      malicious.forEach(input => {
        const result = validation.sanitizeForDocDB(input)
        expect(result).not.toMatch(/^\$/)
      })
    })

    test('should reject dots in field names (nested access)', () => {
      const input = 'user.password'
      const result = validation.sanitizeForDocDB(input)
      expect(result).not.toContain('.')
    })

    test('should remove null bytes', () => {
      const input = 'name\0injected'
      const result = validation.sanitizeForDocDB(input)
      expect(result).not.toContain('\0')
    })

    test('should handle curly braces (object injection)', () => {
      const input = '{"$gt": ""}'
      const result = validation.sanitizeForDocDB(input)
      // Should escape or remove the braces
      expect(result.includes('{') && result.includes('$')).toBe(false)
    })

    test('should not modify safe strings', () => {
      const safe = ['John Doe', 'Hello World', 'A simple note']
      safe.forEach(input => {
        expect(validation.sanitizeForDocDB(input)).toBe(input)
      })
    })

    test('should handle null/undefined gracefully', () => {
      expect(validation.sanitizeForDocDB(null)).toBe('')
      expect(validation.sanitizeForDocDB(undefined)).toBe('')
    })

    test('should handle empty string', () => {
      expect(validation.sanitizeForDocDB('')).toBe('')
    })

    test('should allow $ in middle of strings (like prices)', () => {
      // $5 as a price is fine, only operators like $gt are dangerous
      // But we're being conservative - strip all leading $
      const result = validation.sanitizeForDocDB('Price: $50')
      expect(result).toBe('Price: $50') // $ not at start is OK
    })
  })

  describe('sanitizeInput - Combined sanitization for both backends', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.sanitizeInput).toBe('function')
    })

    test('should protect against both Sheets and DocDB injection', () => {
      // Formula injection attempt
      const formula = '=IMPORTXML("http://evil.com")'
      const result1 = validation.sanitizeInput(formula)
      expect(result1).not.toMatch(/^=/)

      // NoSQL injection attempt
      const nosql = '$where: 1==1'
      const result2 = validation.sanitizeInput(nosql)
      expect(result2).not.toMatch(/^\$/)
    })

    test('should handle combined attack vectors', () => {
      const combined = '={"$gt": ""}'
      const result = validation.sanitizeInput(combined)
      expect(result).not.toMatch(/^=/)
      expect(result.includes('$gt')).toBe(false)
    })

    test('should preserve normal text', () => {
      const normal = 'This is a normal rehearsal note about Act 2, Scene 3.'
      expect(validation.sanitizeInput(normal)).toBe(normal)
    })
  })

  describe('validateProductionCode', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.validateProductionCode).toBe('function')
    })

    test('should accept valid alphanumeric codes', () => {
      expect(validation.validateProductionCode('ABC123')).toBe(true)
      expect(validation.validateProductionCode('myshow2024')).toBe(true)
      expect(validation.validateProductionCode('SHOW-01')).toBe(true)
    })

    test('should reject codes with special characters', () => {
      expect(validation.validateProductionCode('code;DROP')).toBe(false)
      expect(validation.validateProductionCode('code$gt')).toBe(false)
      expect(validation.validateProductionCode('a/b/c')).toBe(false)
    })

    test('should reject empty or null codes', () => {
      expect(validation.validateProductionCode('')).toBe(false)
      expect(validation.validateProductionCode(null)).toBe(false)
      expect(validation.validateProductionCode(undefined)).toBe(false)
    })

    test('should enforce length limits', () => {
      expect(validation.validateProductionCode('a')).toBe(false) // too short
      expect(validation.validateProductionCode('a'.repeat(65))).toBe(false) // too long
      expect(validation.validateProductionCode('abc')).toBe(true) // OK
    })
  })

  describe('validatePin', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.validatePin).toBe('function')
    })

    test('should accept valid PINs (4-8 digits)', () => {
      expect(validation.validatePin('1234')).toBe(true)
      expect(validation.validatePin('12345678')).toBe(true)
      expect(validation.validatePin('0000')).toBe(true)
    })

    test('should reject too short PINs', () => {
      expect(validation.validatePin('123')).toBe(false)
      expect(validation.validatePin('')).toBe(false)
    })

    test('should reject too long PINs', () => {
      expect(validation.validatePin('123456789')).toBe(false)
    })

    test('should reject non-numeric PINs', () => {
      expect(validation.validatePin('abcd')).toBe(false)
      expect(validation.validatePin('12ab')).toBe(false)
      expect(validation.validatePin('1234!')).toBe(false)
    })

    test('should reject null/undefined', () => {
      expect(validation.validatePin(null)).toBe(false)
      expect(validation.validatePin(undefined)).toBe(false)
    })
  })

  describe('validateEmail', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.validateEmail).toBe('function')
    })

    test('should accept valid emails', () => {
      expect(validation.validateEmail('user@example.com')).toBe(true)
      expect(validation.validateEmail('first.last@domain.org')).toBe(true)
      expect(validation.validateEmail('user+tag@gmail.com')).toBe(true)
    })

    test('should reject invalid emails', () => {
      expect(validation.validateEmail('notanemail')).toBe(false)
      expect(validation.validateEmail('@nodomain.com')).toBe(false)
      expect(validation.validateEmail('spaces in@email.com')).toBe(false)
    })

    test('should reject dangerous patterns', () => {
      // Header injection attempts
      expect(validation.validateEmail('user@domain.com\nBcc: evil@hacker.com')).toBe(false)
      expect(validation.validateEmail('user@domain.com\r\nSubject: Pwned')).toBe(false)
    })

    test('should allow empty (optional field)', () => {
      expect(validation.validateEmail('')).toBe(true)
      expect(validation.validateEmail(null)).toBe(true)
    })
  })

  describe('validatePhone', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.validatePhone).toBe('function')
    })

    test('should accept valid phone formats', () => {
      expect(validation.validatePhone('555-123-4567')).toBe(true)
      expect(validation.validatePhone('(555) 123-4567')).toBe(true)
      expect(validation.validatePhone('5551234567')).toBe(true)
      expect(validation.validatePhone('+1 555 123 4567')).toBe(true)
    })

    test('should reject invalid phones', () => {
      expect(validation.validatePhone('not-a-phone')).toBe(false)
      expect(validation.validatePhone('123')).toBe(false) // too short
    })

    test('should reject dangerous characters', () => {
      expect(validation.validatePhone('555-123-4567; rm -rf /')).toBe(false)
      expect(validation.validatePhone('555\n123')).toBe(false)
    })

    test('should allow empty (optional field)', () => {
      expect(validation.validatePhone('')).toBe(true)
      expect(validation.validatePhone(null)).toBe(true)
    })
  })

  describe('validateSheetId', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.validateSheetId).toBe('function')
    })

    test('should accept valid Google Sheet IDs', () => {
      // Google Sheet IDs are alphanumeric with dashes and underscores
      expect(validation.validateSheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')).toBe(true)
      expect(validation.validateSheetId('abc-123_XYZ')).toBe(true)
    })

    test('should reject IDs with dangerous characters', () => {
      expect(validation.validateSheetId('id;DROP TABLE')).toBe(false)
      expect(validation.validateSheetId('id/path/traversal')).toBe(false)
      expect(validation.validateSheetId('id\ninjection')).toBe(false)
    })

    test('should reject empty/null', () => {
      expect(validation.validateSheetId('')).toBe(false)
      expect(validation.validateSheetId(null)).toBe(false)
    })
  })

  describe('sanitizeObject - Recursively sanitize object values', () => {
    test('should be exported', () => {
      expect(validation).not.toBeNull()
      expect(typeof validation.sanitizeObject).toBe('function')
    })

    test('should sanitize all string values in an object', () => {
      const input = {
        name: '=MALICIOUS()',
        notes: '$where: 1==1',
        nested: {
          value: '+FORMULA'
        }
      }
      const result = validation.sanitizeObject(input)
      expect(result.name).not.toMatch(/^=/)
      expect(result.notes).not.toMatch(/^\$/)
      expect(result.nested.value).not.toMatch(/^\+/)
    })

    test('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        items: [1, 2, 3]
      }
      const result = validation.sanitizeObject(input)
      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
      expect(result.items).toEqual([1, 2, 3])
    })

    test('should sanitize strings in arrays', () => {
      const input = {
        tags: ['=formula', 'safe', '$operator']
      }
      const result = validation.sanitizeObject(input)
      expect(result.tags[0]).not.toMatch(/^=/)
      expect(result.tags[1]).toBe('safe')
      expect(result.tags[2]).not.toMatch(/^\$/)
    })

    test('should handle null/undefined', () => {
      expect(validation.sanitizeObject(null)).toEqual({})
      expect(validation.sanitizeObject(undefined)).toEqual({})
    })
  })

  describe('Integration: Real-world input scenarios', () => {
    test('should handle audition form submission', () => {
      const submission = {
        firstName: 'John',
        lastName: '=SUM(A1:A10)', // Attempted formula injection
        email: 'john@example.com',
        phone: '555-123-4567',
        experience: 'Acted in $everal plays', // $ in middle is fine
        conflicts: 'None'
      }
      const sanitized = validation.sanitizeObject(submission)
      expect(sanitized.lastName).not.toMatch(/^=/)
      expect(sanitized.experience).toContain('$everal') // preserved
    })

    test('should handle rehearsal notes', () => {
      const note = {
        text: '=HYPERLINK("http://evil.com","Click here")',
        scene: 'Act 1, Scene 2',
        actor: 'Jane Doe'
      }
      const sanitized = validation.sanitizeObject(note)
      expect(sanitized.text).not.toMatch(/^=/)
      expect(sanitized.scene).toBe('Act 1, Scene 2')
    })

    test('should handle production config', () => {
      const config = {
        title: 'The Music Man',
        showDates: 'March 15-17, 2024',
        characters: ['Harold Hill', 'Marian Paroo', '$pecial Character'] // edge case
      }
      const sanitized = validation.sanitizeObject(config)
      expect(sanitized.characters[2]).not.toMatch(/^\$/)
    })
  })
})
