import { z } from 'zod'

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Include at least one letter and one number',
  })

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Enter your full name')
      .max(160, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password,
    confirm_password: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const studentRegisterSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Enter the name used by your teacher')
      .max(160, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    class_id: z.coerce.number().int().positive('Select your class'),
    roll_number: z
      .string()
      .min(1, 'Enter your registration or roll number')
      .max(50, 'Registration number is too long'),
    password,
    confirm_password: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: password,
    confirm_password: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export const classSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(120),
  department: z.string().min(1, 'Department is required').max(120),
  semester: z.coerce.number().int().min(1).max(12),
  academic_year: z.string().min(4, 'Academic year is required').max(20),
})

export const studentSchema = z.object({
  roll_number: z.string().min(1, 'Roll number is required').max(50),
  full_name: z.string().min(1, 'Student name is required').max(160),
  class_id: z.coerce.number().int().positive('Select a class'),
  is_active: z.boolean().default(true),
})

export const subjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(160),
  subject_code: z.string().min(1, 'Subject code is required').max(40),
  faculty_id: z.coerce.number().int().positive().optional().or(z.literal(0)),
})

export const sessionSchema = z.object({
  class_id: z.coerce.number().int().positive('Select a class'),
  subject_id: z.coerce.number().int().positive('Select a subject'),
  session_date: z.string().min(1, 'Choose a date'),
  session_number: z.coerce.number().int().min(1).max(20),
  notes: z.string().max(1000).optional(),
})

export const customListSchema = z.object({
  title: z.string().min(2, 'Give the list a title').max(180),
  class_id: z.coerce.number().int().positive('Select a class'),
  description: z.string().max(2000).optional(),
  due_date: z.string().optional(),
  visible_to_students: z.boolean().default(false),
})

export const userSchema = z.object({
  full_name: z.string().min(2, 'Full name is required').max(160),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
      message: 'Include at least one letter and one number',
    }),
  role: z.enum(['admin', 'faculty', 'student']),
  student_id: z.coerce.number().int().positive().optional().or(z.literal(0)),
})

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required').max(160),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type StudentRegisterValues = z.infer<typeof studentRegisterSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export type ClassValues = z.infer<typeof classSchema>
export type StudentValues = z.infer<typeof studentSchema>
export type SubjectValues = z.infer<typeof subjectSchema>
export type SessionValues = z.infer<typeof sessionSchema>
export type CustomListValues = z.infer<typeof customListSchema>
export type UserValues = z.infer<typeof userSchema>
