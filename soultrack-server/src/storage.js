import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

function safeLocalPath(rootDir, key) {
  const normalized = key.replace(/^\/+/, '')
  const resolved = path.resolve(rootDir, normalized)
  const rootResolved = path.resolve(rootDir)
  if (!resolved.startsWith(rootResolved + path.sep)) {
    throw new Error('Invalid storage key')
  }
  return resolved
}

export function createStorage(config) {
  if (config.storageMode === 'r2') {
    if (!config.r2Configured) {
      throw new Error('STORAGE_MODE=r2 requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_URL.')
    }

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    })

    return {
      mode: 'r2',
      async putFile({ key, filePath, contentType }) {
        await client.send(new PutObjectCommand({
          Bucket: config.r2.bucket,
          Key: key,
          Body: fs.createReadStream(filePath),
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }))
        return `${config.r2.publicUrl}/${key}`
      },
      async deleteKeys(keys) {
        const clean = keys.filter(Boolean)
        await Promise.allSettled(
          clean.map(Key => client.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key })))
        )
      },
    }
  }

  return {
    mode: 'local',
    async putFile({ key, filePath }) {
      const target = safeLocalPath(config.localMediaDir, key)
      await fsp.mkdir(path.dirname(target), { recursive: true })
      await fsp.copyFile(filePath, target)
      const prefix = config.publicBaseUrl ? `${config.publicBaseUrl}/media` : '/media'
      return `${prefix}/${key}`
    },
    async deleteKeys(keys) {
      await Promise.allSettled(
        keys.filter(Boolean).map(async key => {
          const target = safeLocalPath(config.localMediaDir, key)
          await fsp.rm(target, { force: true })
        })
      )
    },
  }
}
