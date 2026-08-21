import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || "admin_user",
    secretAccessKey: process.env.MINIO_SECRET_KEY || "StrongPassword123",
  },
  forcePathStyle: true,
});

export async function POST(req: Request) {
  try {
    const { boardId, data } = await req.json();
    const bucket = process.env.MINIO_BUCKET || "excalidraw-scenes";

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${boardId}.json`,
        Body: JSON.stringify(data),
        ContentType: "application/json",
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
