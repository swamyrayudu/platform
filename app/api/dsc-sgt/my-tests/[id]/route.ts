// ============================================================
// app/api/dsc-sgt/my-tests/[id]/route.ts — One user-made test
// ============================================================
// GET     the test with its questions and recent attempts. The user wrote
//         the answer key themselves, so it is sent whole: the test is graded
//         in the browser and again on the server when submitted.
// DELETE  the test, its file and its attempts.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { deleteMyTest, getMyTest, listAttempts } from '@/lib/my-tests/store'
import { myTestsError } from '../respond'

type Params = { params: Promise<{ id: string }> }
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

export const GET = requireAuth(async (_request: Request, { params }: Params, { user }) => {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ success: false, error: 'Test not found.' }, { status: 404 })
    const [test, attempts] = await Promise.all([getMyTest(user.id, id), listAttempts(user.id, id)])
    if (!test) return NextResponse.json({ success: false, error: 'Test not found.' }, { status: 404 })
    return NextResponse.json({ success: true, test, attempts })
  } catch (err) {
    return myTestsError(err, 'Could not load this test.')
  }
})

export const DELETE = requireAuth(async (_request: Request, { params }: Params, { user }) => {
  try {
    const { id } = await params
    if (!isUuid(id) || !(await deleteMyTest(user.id, id))) {
      return NextResponse.json({ success: false, error: 'Test not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return myTestsError(err, 'Could not delete this test.')
  }
})
