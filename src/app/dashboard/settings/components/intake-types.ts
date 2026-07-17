export type FieldTypeConstraint =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  // Media uploads that go to the child's library only
  | 'media_photo'
  | 'media_video'
  // Media uploads that also become the child's profile photo / video on save
  | 'profile_photo'
  | 'profile_video'

export interface QuestionInput {
  id?: string
  question_text: string
  field_type: FieldTypeConstraint
  choices?: string[]
}

export interface IntakeTemplate {
  id: string
  title: string
  country: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  template_questions?: {
    id: string
    question_text: string
    field_type: FieldTypeConstraint
    sort_order: number
    choices: string[] | null
  }[]
}