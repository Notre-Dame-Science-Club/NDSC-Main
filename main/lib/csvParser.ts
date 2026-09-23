// CSV parsing and validation for bulk account creation.
//
// Counterpart to lib/csv.ts (which handles CSV export). This handles CSV
// import: parsing uploaded CSV files into structured data and validating
// each row against the requirements for member/user account creation.

import { validateCollegeRoll } from './validation'

export type CsvCell = string | number | null | undefined

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export interface AccountData {
  email: string
  full_name: string
  phone?: string
  college_roll?: string
  batch?: string
  department?: string       // members only
  college?: string          // users only
  hsc_session?: string      // users only
}

export interface ValidationError {
  row: number
  errors: string[]
}

export interface ValidatedAccounts {
  valid: AccountData[]
  errors: ValidationError[]
}

/**
 * Parse a CSV string into headers and rows.
 * Handles quoted fields, escaped commas, and embedded newlines.
 */
export function parseCsv(csvText: string): ParsedCsv {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  // Split by lines, respecting quoted newlines
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const next = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if ((char === '\n' || (char === '\r' && next === '\n')) && !inQuotes) {
      // Line break outside quotes
      if (current.trim()) lines.push(current)
      current = ''
      if (char === '\r') i++ // Skip \n in \r\n
    } else {
      current += char
    }
  }
  if (current.trim()) lines.push(current)

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // Parse header row
  const headers = parseRow(lines[0])

  // Parse data rows
  const rows = lines.slice(1).map(line => parseRow(line))

  return { headers, rows }
}

/**
 * Parse a single CSV row into cells.
 */
function parseRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Cell separator
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())

  return cells
}

/**
 * Validate CSV data for bulk account creation.
 * Returns valid accounts and validation errors.
 */
export function validateAccountsCsv(
  headers: string[],
  rows: string[][],
  accountType: 'member' | 'user'
): ValidatedAccounts {
  const valid: AccountData[] = []
  const errors: ValidationError[] = []

  // Normalize headers to lowercase for case-insensitive matching
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => {
    headerMap.set(h.toLowerCase().trim(), i)
  })

  // Helper to get cell value by header name
  const getCell = (row: string[], headerName: string): string | undefined => {
    const index = headerMap.get(headerName.toLowerCase())
    if (index === undefined) return undefined
    const value = row[index]?.trim()
    return value || undefined
  }

  // Required headers for both types
  const requiredHeaders = ['email', 'full_name']
  if (accountType === 'member') {
    requiredHeaders.push('college_roll')
  }

  // Check if all required headers are present
  const missingHeaders = requiredHeaders.filter(h => !headerMap.has(h.toLowerCase()))
  if (missingHeaders.length > 0) {
    errors.push({
      row: 0,
      errors: [`Missing required columns: ${missingHeaders.join(', ')}`]
    })
    return { valid: [], errors }
  }

  // Validate each row
  rows.forEach((row, index) => {
    const rowNum = index + 2 // +2 because: +1 for 1-based indexing, +1 for header row
    const rowErrors: string[] = []

    const email = getCell(row, 'email')
    const full_name = getCell(row, 'full_name')
    const phone = getCell(row, 'phone')
    const college_roll = getCell(row, 'college_roll')
    const batch = getCell(row, 'batch')

    // Validate required fields
    if (!email) {
      rowErrors.push('Email is required')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push('Invalid email format')
    }

    if (!full_name) {
      rowErrors.push('Full name is required')
    }

    if (accountType === 'member') {
      // Member-specific validation
      const department = getCell(row, 'department')

      // College roll is required for members
      if (!college_roll) {
        rowErrors.push('College roll is required for members')
      } else {
        // Validate college roll (assumes Notre Dame College by default)
        const rollError = validateCollegeRoll('Notre Dame College', college_roll)
        if (rollError) {
          rowErrors.push(rollError)
        }
      }

      // Department validation (optional, but if provided must be valid)
      const validDepartments = ['Administration', 'Project', 'Publication', 'ICT', 'LWS', 'Quiz', 'R&D']
      if (department && !validDepartments.includes(department)) {
        rowErrors.push(`Invalid department. Must be one of: ${validDepartments.join(', ')}`)
      }

      if (rowErrors.length === 0) {
        valid.push({
          email: email!,
          full_name: full_name!,
          phone,
          college_roll,
          batch,
          department
        })
      }
    } else {
      // User-specific validation
      const college = getCell(row, 'college')
      const hsc_session = getCell(row, 'hsc_session')

      // College roll validation (optional for non-NDC users)
      if (college_roll) {
        const rollError = validateCollegeRoll(college, college_roll)
        if (rollError) {
          rowErrors.push(rollError)
        }
      }

      if (rowErrors.length === 0) {
        valid.push({
          email: email!,
          full_name: full_name!,
          phone,
          college,
          college_roll,
          hsc_session,
          batch
        })
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, errors: rowErrors })
    }
  })

  return { valid, errors }
}

/**
 * Generate a sample CSV template for the given account type.
 */
export function generateCsvTemplate(accountType: 'member' | 'user'): string {
  if (accountType === 'member') {
    return [
      'email,full_name,phone,college_roll,batch,department',
      'john@example.com,John Doe,01712345678,12345678,2024,ICT',
      'jane@example.com,Jane Smith,01798765432,87654321,2023,Publication'
    ].join('\n')
  } else {
    return [
      'email,full_name,phone,college,college_roll,hsc_session,batch',
      'participant1@example.com,Alice Brown,01712345678,Notre Dame College,12345678,2023-24,2024',
      'participant2@example.com,Bob Wilson,01798765432,Dhaka College,98765,2022-23,2023'
    ].join('\n')
  }
}
