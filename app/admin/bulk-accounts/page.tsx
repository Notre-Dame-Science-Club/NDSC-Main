'use client'
import { useState, ChangeEvent } from 'react'
import { Download, Upload, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { parseCsv, validateAccountsCsv, generateCsvTemplate, type AccountData } from '@/lib/csvParser'

type AccountType = 'member' | 'user'

type CreateResult = {
  email: string
  status: 'success' | 'failed'
  reason?: string
}

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }

export default function BulkAccountsPage() {
  const [accountType, setAccountType] = useState<AccountType>('member')
  const [csvText, setCsvText] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [defaultPassword, setDefaultPassword] = useState('ndsc2026')
  const [autoVerify, setAutoVerify] = useState(true)
  const [preview, setPreview] = useState<AccountData[]>([])
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; errors: string[] }>>([])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<CreateResult[] | null>(null)

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      parseAndValidate(text)
    }
    reader.readAsText(file)
  }

  const handleTextChange = (text: string) => {
    setCsvText(text)
    setCsvFile(null)
    parseAndValidate(text)
  }

  const parseAndValidate = (text: string) => {
    if (!text.trim()) {
      setPreview([])
      setValidationErrors([])
      return
    }

    const { headers, rows } = parseCsv(text)
    const { valid, errors } = validateAccountsCsv(headers, rows, accountType)

    setPreview(valid)
    setValidationErrors(errors)
  }

  const handleSubmit = async () => {
    if (preview.length === 0) return

    setProcessing(true)
    setResults(null)

    try {
      const response = await fetch('/api/admin/bulk-create-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          default_password: defaultPassword,
          auto_verify: autoVerify,
          accounts: preview,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to create accounts')
        return
      }

      setResults(data.results || [])
    } catch (err) {
      alert('Network error. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const template = generateCsvTemplate(accountType)
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${accountType}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadResults = () => {
    if (!results) return

    const lines = ['email,status,reason']
    results.forEach(r => {
      lines.push(`${r.email},${r.status},${r.reason || ''}`)
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bulk_creation_results_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const successCount = results?.filter(r => r.status === 'success').length || 0
  const failedCount = results?.filter(r => r.status === 'failed').length || 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={h}>Bulk Create Accounts</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Create multiple member or user accounts from CSV data. All accounts will use the same default password.
        </p>
      </div>

      {/* Account Type Selection */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Account Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={accountType === 'member'}
              onChange={() => {
                setAccountType('member')
                if (csvText) parseAndValidate(csvText)
              }}
              className="w-4 h-4"
            />
            <span className="text-sm" style={{ color: 'var(--white)' }}>Members (NDSC club members)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={accountType === 'user'}
              onChange={() => {
                setAccountType('user')
                if (csvText) parseAndValidate(csvText)
              }}
              className="w-4 h-4"
            />
            <span className="text-sm" style={{ color: 'var(--white)' }}>Users (Event participants)</span>
          </label>
        </div>
      </div>

      {/* CSV Upload */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold" style={{ color: 'var(--white)' }}>CSV Data</label>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
          >
            <Download size={12} /> Download Template
          </button>
        </div>

        <div className="mb-3">
          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer hover:bg-opacity-50 transition-all"
            style={{ borderColor: 'var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
            <Upload size={16} style={{ color: 'var(--blue)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>
              {csvFile ? csvFile.name : 'Upload CSV File'}
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="text-xs text-center mb-3" style={{ color: 'var(--muted)' }}>OR</div>

        <textarea
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste CSV data here..."
          rows={8}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none font-mono"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
        />
      </div>

      {/* Settings */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Settings</label>

        <div className="mb-3">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Default Password</label>
          <input
            type="text"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            placeholder="Enter default password"
            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            All accounts will be created with this password. Minimum 6 characters.
          </p>
        </div>

        {accountType === 'member' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoVerify}
              onChange={(e) => setAutoVerify(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm" style={{ color: 'var(--white)' }}>Auto-verify members (skip payment verification)</span>
          </label>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border" style={{ background: 'rgba(var(--danger-rgb), 0.05)', borderColor: 'rgba(var(--danger-rgb), 0.3)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--danger)' }}>
              {validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {validationErrors.map((err, i) => (
              <div key={i} className="text-xs" style={{ color: 'var(--danger-soft)' }}>
                Row {err.row}: {err.errors.join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: 'var(--white)' }}>Preview ({preview.length} accounts)</h2>
            <button
              onClick={handleSubmit}
              disabled={processing || defaultPassword.length < 6}
              className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--blue)', color: '#000' }}
            >
              {processing ? 'Creating...' : `Create ${preview.length} Account${preview.length > 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="rounded-xl border overflow-hidden" style={s}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Email</th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Full Name</th>
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Phone</th>
                    {accountType === 'member' ? (
                      <>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>College Roll</th>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Department</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>College</th>
                        <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Roll</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((acc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--white)' }}>{acc.email}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--white)' }}>{acc.full_name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{acc.phone || '—'}</td>
                      {accountType === 'member' ? (
                        <>
                          <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{acc.college_roll}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{acc.department || '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{acc.college || '—'}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{acc.college_roll || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="p-4 rounded-xl border" style={s}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--white)' }}>Creation Results</h2>
            <button
              onClick={downloadResults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
            >
              <Download size={12} /> Download Report
            </button>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              <span className="text-sm" style={{ color: 'var(--success)' }}>
                {successCount} successful
              </span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center gap-2">
                <XCircle size={16} style={{ color: 'var(--danger)' }} />
                <span className="text-sm" style={{ color: 'var(--danger)' }}>
                  {failedCount} failed
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((result, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                style={{
                  background: result.status === 'success' ? 'rgba(var(--success-rgb), 0.05)' : 'rgba(var(--danger-rgb), 0.05)',
                  border: `1px solid ${result.status === 'success' ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--danger-rgb), 0.2)'}`
                }}
              >
                <span style={{ color: 'var(--white)' }}>{result.email}</span>
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <span style={{ color: 'var(--success)' }}>✓ Created</span>
                  ) : (
                    <span style={{ color: 'var(--danger)' }}>✗ {result.reason}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
