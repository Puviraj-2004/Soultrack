const R2_UPLOAD_URL = import.meta.env.VITE_R2_UPLOAD_URL
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL

function normalizePublicUrl(url) {
  return url?.replace(/\/$/, '')
}

function uploadWithProgress({ url, formData, onProgress, providerName, resolveUrl }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()

    request.upload.addEventListener('progress', event => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener('load', () => {
      let data

      try {
        data = JSON.parse(request.responseText)
      } catch {
        reject(new Error(`${providerName} returned an invalid response.`))
        return
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data.error?.message || data.error || `${providerName} upload failed.`))
        return
      }

      const publicUrl = resolveUrl(data)
      if (!publicUrl) {
        reject(new Error(`${providerName} upload succeeded but no public URL was returned.`))
        return
      }

      onProgress?.(100)
      resolve(publicUrl)
    })

    request.addEventListener('error', () => reject(new Error(`${providerName} upload failed. Check your connection.`)))
    request.addEventListener('abort', () => reject(new Error(`${providerName} upload was cancelled.`)))
    request.open('POST', url)
    request.send(formData)
  })
}

export async function uploadSongFile(file, playlistId, onProgress) {
  if (!R2_UPLOAD_URL) {
    throw new Error('R2 upload URL is required.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', playlistId || 'library')

  return uploadWithProgress({
    url: R2_UPLOAD_URL,
    formData,
    onProgress,
    providerName: 'R2',
    resolveUrl: data => {
      if (data.url) return data.url
      if (data.publicUrl) return data.publicUrl
      if (data.key && R2_PUBLIC_URL) return `${normalizePublicUrl(R2_PUBLIC_URL)}/${data.key}`
      return null
    },
  })
}
