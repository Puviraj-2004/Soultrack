const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER

export async function uploadSongFile(file, playlistId, onProgress) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary cloud name and unsigned upload preset are required.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('context', `playlist_id=${playlistId}`)

  if (CLOUDINARY_FOLDER) {
    formData.append('folder', `${CLOUDINARY_FOLDER}/${playlistId}`)
  }

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
        reject(new Error('Cloudinary returned an invalid response.'))
        return
      }

      if (request.status < 200 || request.status >= 300) {
        reject(new Error(data.error?.message || 'Cloudinary upload failed.'))
        return
      }

      onProgress?.(100)
      resolve(data.secure_url)
    })

    request.addEventListener('error', () => reject(new Error('Cloudinary upload failed. Check your connection.')))
    request.addEventListener('abort', () => reject(new Error('Cloudinary upload was cancelled.')))
    request.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`)
    request.send(formData)
  })
}
