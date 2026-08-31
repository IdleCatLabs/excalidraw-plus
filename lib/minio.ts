import * as Minio from 'minio';

// 严格清洗 Endpoint：去除 http://、https://、末尾斜杠以及附带的端口
function cleanEndpoint(rawEndpoint: string): string {
  if (!rawEndpoint) return 'minio';
  return rawEndpoint
    .replace(/^https?:\/\//i, '') // 移除 http:// 或 https://
    .split('/')[0]                // 移除路径
    .split(':')[0];               // 移除端口（端口由 port 参数单独指定）
}

const rawEndpoint = process.env.MINIO_ENDPOINT || 'minio';
const endpoint = cleanEndpoint(rawEndpoint);

const port = parseInt(
  process.env.MINIO_PORT ||
  (process.env.MINIO_ENDPOINT?.includes(':') ? process.env.MINIO_ENDPOINT.split(':').pop()! : '9000'),
  10
) || 9000;

const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey =
  process.env.MINIO_ACCESS_KEY ||
  process.env.MINIO_ROOT_USER ||
  'minioadmin';
const secretKey =
  process.env.MINIO_SECRET_KEY ||
  process.env.MINIO_ROOT_PASSWORD ||
  'minioadmin';

export const minioClient = new Minio.Client({
  endPoint: endpoint,
  port: port,
  useSSL: useSSL,
  accessKey: accessKey,
  secretKey: secretKey,
});

export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'excalidraw';

/**
 * 确保存储桶存在
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`[MinIO] Bucket "${BUCKET_NAME}" created successfully.`);
    }
  } catch (error: any) {
    console.error(`[MinIO] Bucket check/creation failed:`, error.message);
    throw error;
  }
}