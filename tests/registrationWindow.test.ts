import test from 'node:test'
import assert from 'node:assert/strict'
import { activityRegistrationOpen as a, olympiadRegistrationOpen as o } from '../lib/registrationWindow.ts'

const now = new Date('2026-06-01T00:00:00Z')
test('activity open', () => assert.equal(a({ is_upcoming: true, registration_enabled: true }, now).open, true))
test('activity disabled', () => assert.equal(a({ is_upcoming: true, registration_enabled: false }, now).open, false))
test('activity not upcoming', () => assert.equal(a({ is_upcoming: false, registration_enabled: true }, now).open, false))
test('activity past deadline', () => assert.equal(a({ is_upcoming: true, registration_enabled: true, reg_deadline: '2026-05-01T00:00:00Z' }, now).open, false))
test('activity future deadline', () => assert.equal(a({ is_upcoming: true, registration_enabled: true, reg_deadline: '2026-07-01T00:00:00Z' }, now).open, true))
test('olympiad inactive', () => assert.equal(o({ is_active: false }, now).open, false))
test('olympiad null flags stay open', () => assert.equal(o({}, now).open, true))
test('olympiad past deadline', () => assert.equal(o({ registration_deadline: '2026-05-01T00:00:00Z' }, now).open, false))
