export type BioFacts = {
  age?: string | number | null
  country?: string | null
  homeDuration?: string | null
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanAge(age: BioFacts['age']): string {
  if (age === null || age === undefined) return ''
  return String(age).trim()
}

function cleanCountry(country: BioFacts['country']): string {
  return cleanText(country ?? '')
}

function cleanHomeDuration(homeDuration: BioFacts['homeDuration']): string {
  return cleanText(homeDuration ?? '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasAge(text: string, age: string): boolean {
  return new RegExp(`\\b${escapeRegExp(age)}\\b`).test(text)
}

function hasCountry(text: string, country: string): boolean {
  return cleanText(text).toLowerCase().includes(country.toLowerCase())
}

function requiredFactsSentence(age: string, country: string): string {
  if (age && country) return `I am ${age} years old and I am from ${country}.`
  if (age) return `I am ${age} years old.`
  return `I am from ${country}.`
}

function homeDurationSentence(homeDuration: string): string {
  return `I have been at the Children's Home for ${homeDuration}.`
}

function insertAfterFirstSentence(text: string, sentence: string): string {
  const firstSentence = text.match(/^(.+?[.!?])(\s+|$)([\s\S]*)$/)
  if (!firstSentence) return `${sentence} ${text}`.trim()

  const [, first, , rest] = firstSentence
  return `${first} ${sentence}${rest ? ` ${rest.trimStart()}` : ''}`.trim()
}

export function ageFromBirthParts(
  year?: number | null,
  month?: number | null,
  day?: number | null,
): number | null {
  if (!year) return null

  const today = new Date()
  const birthDate = new Date(year, (month ?? 1) - 1, day ?? 1)
  let age = today.getFullYear() - birthDate.getFullYear()

  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age >= 0 ? age : null
}

export function homeDurationFromDate(dateJoined?: string | null): string {
  if (!dateJoined) return ''

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateJoined)
    ? `${dateJoined}T12:00:00`
    : dateJoined
  const joined = new Date(normalized)
  if (Number.isNaN(joined.getTime())) return ''

  const now = new Date()
  let months =
    (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth()

  if (now.getDate() < joined.getDate()) months -= 1
  if (months < 0) return ''
  if (months === 0) return 'less than one month'
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`

  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  const yearText = `${years} year${years === 1 ? '' : 's'}`
  if (remainingMonths === 0) return yearText
  return `${yearText} and ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`
}

export function hasRequiredBioFacts(facts: BioFacts): boolean {
  return Boolean(cleanAge(facts.age) && cleanCountry(facts.country) && cleanHomeDuration(facts.homeDuration))
}

export function ensureBioIncludesAgeAndCountry(bio: string, facts: BioFacts): string {
  let text = cleanText(bio)
  const age = cleanAge(facts.age)
  const country = cleanCountry(facts.country)
  const homeDuration = cleanHomeDuration(facts.homeDuration)

  if (!age && !country && !homeDuration) return text
  if (!text) {
    return [
      age || country ? requiredFactsSentence(age, country) : null,
      homeDuration ? homeDurationSentence(homeDuration) : null,
    ].filter(Boolean).join(' ')
  }

  const missingAge = age ? !hasAge(text, age) : false
  const missingCountry = country ? !hasCountry(text, country) : false
  const missingHomeDuration = homeDuration ? !text.toLowerCase().includes(homeDuration.toLowerCase()) : false

  if (missingAge || missingCountry) {
    text = insertAfterFirstSentence(
      text,
      requiredFactsSentence(missingAge ? age : '', missingCountry ? country : ''),
    )
  }

  if (missingHomeDuration) {
    text = insertAfterFirstSentence(text, homeDurationSentence(homeDuration))
  }

  return text
}
