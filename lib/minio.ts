import * as Minio from 'minio';

function resolveMinioEndpoint(): string {
  if (process.env.MINIO_ENDPOINT) {
    return process.env.MINIO_ENDPOINT
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0];
  }
  // 生产环境容器内走 minio 服务名，本地调试默认回退 127.0.0.1
  return process.env.NODE_ENV === 'production' ? 'minio' : '127.0.0.1';
}

const endpoint = resolveMinioEndpoint();
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
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

export async function ensureBucketExists(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`[MinIO] Bucket "${BUCKET_NAME}" created.`);
    }
  } catch (error: any) {
    console.error(`[MinIO] Error checking/creating bucket "${BUCKET_NAME}":`, error);
    throw new Error(`MinIO 存储桶连接异常: ${error.message || error.code}`);
  }
}