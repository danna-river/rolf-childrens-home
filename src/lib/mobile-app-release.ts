import 'server-only'

const defaultStoragePath = 'android/rolf-field-latest.apk'

function envValue(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

function optionalEnvValue(name: string): string | null {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

function filenameFromPath(path: string): string {
  const filename = path.split('/').filter(Boolean).at(-1)
  return filename && filename.endsWith('.apk') ? filename : 'rolf-field-latest.apk'
}

const storagePath = envValue('ROLF_FIELD_ANDROID_APK_PATH', defaultStoragePath)

export const mobileAppRelease = {
  versionName: optionalEnvValue('ROLF_FIELD_ANDROID_VERSION_NAME'),
  versionCode: optionalEnvValue('ROLF_FIELD_ANDROID_VERSION_CODE'),
  releaseDate: optionalEnvValue('ROLF_FIELD_ANDROID_RELEASE_DATE'),
  minAndroidVersion: envValue('ROLF_FIELD_ANDROID_MIN_VERSION', 'Android 10+'),
  bucket: envValue('ROLF_FIELD_ANDROID_APK_BUCKET', 'mobile-app-releases'),
  storagePath,
  filename: envValue('ROLF_FIELD_ANDROID_APK_FILENAME', filenameFromPath(storagePath)),
}

export const MOBILE_APP_SIGNED_URL_SECONDS = 60
export const MOBILE_APP_DOWNLOAD_ROUTE = '/api/admin/mobile-app/download'
