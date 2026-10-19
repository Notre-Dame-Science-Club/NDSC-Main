import test from 'node:test'
import assert from 'node:assert/strict'
import { computePathFee } from '../lib/paymentFee.ts'

const n = (amount?: any) => ({ behavior: amount === undefined ? {} : { requires_payment: { amount } } })

test('no fees -> 0', () => assert.equal(computePathFee([n(), n()]), 0))
test('leaf-only fee', () => assert.equal(computePathFee([n(), n(300)]), 300))
test('root + leaf add up', () => assert.equal(computePathFee([n(100), n(300)]), 400))
test('root-only (root is terminal)', () => assert.equal(computePathFee([n(150)]), 150))
test('ignores junk amounts', () => assert.equal(computePathFee([n('x'), n(-5), n(NaN), n(0)]), 0))
