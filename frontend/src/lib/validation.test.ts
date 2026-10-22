import { describe, expect, it } from 'vitest'
import {
  classSchema,
  loginSchema,
  registerSchema,
  studentSchema,
  userSchema,
} from './validation'

describe('loginSchema', () => {
  it('rejects malformed credentials', () => {
    const result = loginSchema.safeParse({ email: 'admin', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0])
      expect(fields).toContain('email')
      expect(fields).toContain('password')
    }
  })

  it('accepts a valid email and password', () => {
    expect(
      loginSchema.safeParse({ email: 'admin@campus.edu', password: 'Admin@12345' }).success,
    ).toBe(true)
  })
})

describe('registerSchema', () => {
  it('requires matching passwords and a strong enough password', () => {
    const result = registerSchema.safeParse({
      full_name: 'Priya Raman',
      email: 'priya@campus.edu',
      password: 'password',
      confirm_password: 'different',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain('Include at least one letter and one number')
      expect(messages).toContain('Passwords do not match')
    }
  })

  it('accepts a complete registration', () => {
    expect(
      registerSchema.safeParse({
        full_name: 'Priya Raman',
        email: 'priya@campus.edu',
        password: 'Faculty@12345',
        confirm_password: 'Faculty@12345',
      }).success,
    ).toBe(true)
  })
})

describe('form coercion', () => {
  it('coerces class and student identifiers from selects', () => {
    const student = studentSchema.parse({
      roll_number: 'CS23-001',
      full_name: 'Aarav Menon',
      class_id: '3',
      is_active: true,
    })
    expect(student.class_id).toBe(3)

    const classRoom = classSchema.parse({
      name: 'III CSE',
      department: 'Computer Science',
      semester: '6',
      academic_year: '2026-27',
    })
    expect(classRoom.semester).toBe(6)
  })

  it('enforces semester bounds', () => {
    const result = classSchema.safeParse({
      name: 'III CSE',
      department: 'Computer Science',
      semester: '13',
      academic_year: '2026-27',
    })
    expect(result.success).toBe(false)
  })

  it('validates user roles and password rules', () => {
    expect(
      userSchema.safeParse({
        full_name: 'Rahul Verma',
        email: 'rahul@campus.edu',
        password: 'weak',
        role: 'faculty',
        student_id: 0,
      }).success,
    ).toBe(false)

    expect(
      userSchema.safeParse({
        full_name: 'Rahul Verma',
        email: 'rahul@campus.edu',
        password: 'Faculty@12345',
        role: 'owner',
        student_id: 0,
      }).success,
    ).toBe(false)
  })
})
