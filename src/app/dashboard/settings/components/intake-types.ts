export type FieldTypeConstraint = 'text' | 'number' | 'date' | 'boolean' | 'select'

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