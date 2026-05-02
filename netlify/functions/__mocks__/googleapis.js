'use strict'

/**
 * Mock for googleapis module
 * Provides mock implementations for Google Sheets and Drive APIs
 */

// In-memory data store for mock sheets
const mockSheetData = new Map()

// Default test data
const defaultRegistryData = [
  ['productionCode', 'title', 'sheetId', 'pinHash', 'adminPinHash', 'createdAt'],
  ['TEST123', 'Test Production', 'test-sheet-id', '2hs8dl2', 'abc123hash', '2024-01-01T00:00:00Z']
]

const defaultSharedWithData = [
  ['name', 'email', 'pinHash', 'inviteCode', 'activated', 'role', 'staffRole', 'ntfyTopic', 'phone'],
  ['John Doe', 'john@example.com', 'userhash1', '', 'true', 'member', 'Actor', '', '555-1234'],
  ['Jane Smith', 'jane@example.com', '', 'INVITE01', 'false', 'admin', 'Director', '', '555-5678']
]

const defaultConfigData = [
  ['title', 'Test Production'],
  ['directorName', 'Jane Smith'],
  ['directorEmail', 'jane@example.com'],
  ['showDates', '2024-06-01 - 2024-06-15']
]

// Initialize with default data
mockSheetData.set('test-registry-sheet-id:Registry!A:F', defaultRegistryData)
mockSheetData.set('test-sheet-id:SharedWith!A:I', defaultSharedWithData)
mockSheetData.set('test-sheet-id:Config!A:B', defaultConfigData)

// Mock Sheets API
const mockSheetsApi = {
  spreadsheets: {
    values: {
      get: jest.fn().mockImplementation(async ({ spreadsheetId, range }) => {
        const key = `${spreadsheetId}:${range}`
        // Try exact match first
        if (mockSheetData.has(key)) {
          return { data: { values: mockSheetData.get(key) } }
        }
        // Try prefix match for range variations
        for (const [k, v] of mockSheetData.entries()) {
          if (k.startsWith(`${spreadsheetId}:`) && k.includes(range.split('!')[0])) {
            return { data: { values: v } }
          }
        }
        return { data: { values: [] } }
      }),

      update: jest.fn().mockImplementation(async ({ spreadsheetId, range, requestBody }) => {
        const key = `${spreadsheetId}:${range}`
        mockSheetData.set(key, requestBody.values)
        return { data: { updatedRows: requestBody.values.length } }
      }),

      append: jest.fn().mockImplementation(async ({ spreadsheetId, range, requestBody }) => {
        const key = `${spreadsheetId}:${range}`
        const existing = mockSheetData.get(key) || []
        mockSheetData.set(key, [...existing, ...requestBody.values])
        return { data: { updates: { updatedRows: requestBody.values.length } } }
      }),

      clear: jest.fn().mockResolvedValue({ data: {} })
    },

    batchUpdate: jest.fn().mockResolvedValue({ data: {} })
  }
}

// Mock Drive API
const mockDriveApi = {
  files: {
    create: jest.fn().mockImplementation(async ({ requestBody }) => {
      const id = 'mock-file-' + Math.random().toString(36).slice(2, 10)
      return { data: { id, name: requestBody.name } }
    }),

    delete: jest.fn().mockResolvedValue({ data: {} }),

    list: jest.fn().mockResolvedValue({ data: { files: [] } }),

    get: jest.fn().mockImplementation(async ({ fileId }) => {
      return { data: { id: fileId, name: 'Mock File', parents: ['parent-folder-id'] } }
    })
  }
}

// Mock GoogleAuth
class MockGoogleAuth {
  constructor(options) {
    this.options = options
  }

  getClient() {
    return Promise.resolve({
      request: jest.fn().mockResolvedValue({ data: {} })
    })
  }
}

const google = {
  auth: {
    GoogleAuth: MockGoogleAuth
  },

  sheets: jest.fn().mockReturnValue(mockSheetsApi),
  drive: jest.fn().mockReturnValue(mockDriveApi)
}

// Helper to set mock data for tests
function setMockSheetData(spreadsheetId, range, data) {
  const key = `${spreadsheetId}:${range}`
  mockSheetData.set(key, data)
}

// Helper to get current mock data
function getMockSheetData(spreadsheetId, range) {
  const key = `${spreadsheetId}:${range}`
  return mockSheetData.get(key)
}

// Helper to clear all mock data and reset to defaults
function resetMockData() {
  mockSheetData.clear()
  mockSheetData.set('test-registry-sheet-id:Registry!A:F', [...defaultRegistryData])
  mockSheetData.set('test-sheet-id:SharedWith!A:I', [...defaultSharedWithData])
  mockSheetData.set('test-sheet-id:Config!A:B', [...defaultConfigData])

  // Clear mock call history
  mockSheetsApi.spreadsheets.values.get.mockClear()
  mockSheetsApi.spreadsheets.values.update.mockClear()
  mockSheetsApi.spreadsheets.values.append.mockClear()
  mockSheetsApi.spreadsheets.values.clear.mockClear()
  mockSheetsApi.spreadsheets.batchUpdate.mockClear()
  mockDriveApi.files.create.mockClear()
  mockDriveApi.files.delete.mockClear()
}

module.exports = {
  google,
  // Export helpers for test manipulation
  __setMockSheetData: setMockSheetData,
  __getMockSheetData: getMockSheetData,
  __resetMockData: resetMockData,
  __mockSheetsApi: mockSheetsApi,
  __mockDriveApi: mockDriveApi
}
