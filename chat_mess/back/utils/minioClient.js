const AWS = require('aws-sdk');

const rawEndpoint = process.env.MINIO_ENDPOINT || "http://minio:9000";
const MINIO_PORT = process.env.MINIO_PORT || "9000";
// Allow env MINIO_ENDPOINT to be host-only (e.g., "minio")
const MINIO_ENDPOINT = rawEndpoint.startsWith("http")
  ? rawEndpoint
  : `http://${rawEndpoint}:${MINIO_PORT}`;
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "my-bucket";
const useSSL = MINIO_ENDPOINT.startsWith("https://");

const s3 = new AWS.S3({
  accessKeyId: process.env.MINIO_ACCESS_KEY || "admin",
  secretAccessKey: process.env.MINIO_SECRET_KEY || "strongpassword123",
  endpoint: MINIO_ENDPOINT,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  sslEnabled: useSSL,
});

async function initializeMinIO() {
  const bucketName = MINIO_BUCKET;
  try {
    await s3.headBucket({ Bucket: bucketName }).promise();
    console.log(`Bucket ${bucketName} already exists`);
  } catch (err) {
    if (err.statusCode === 404) {
      await s3.createBucket({ Bucket: bucketName }).promise();
      console.log(`Created bucket ${bucketName}`);
    } else {
      console.error("Error checking bucket:", err);
      throw err;
    }
  }

  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: "*" },
        Action: ["s3:GetObject", "s3:PutObject"],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  };

  try {
    await s3.putBucketPolicy({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    }).promise();
    console.log(`Set policy for bucket ${bucketName}`);
  } catch (err) {
    console.error("Error setting bucket policy:", err);
  }
}

async function uploadToMinio(fileBuffer, fileName, mimeType) {
  const params = {
    Bucket: MINIO_BUCKET,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
  };
  try {
    await s3.putObject(params).promise();
    console.log(`Successfully uploaded ${fileName} to my-bucket`);
    return fileName;
  } catch (err) {
    console.error(`Failed to upload ${fileName}:`, err);
    throw err;
  }
}

function generatePresignedUrl(fileName) {
  // Bucket has public read policy — use direct URL (no expiration)
  return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${fileName}`;
}

/**
 * Resolve a stored value (key or old presigned URL) to a direct public URL.
 */
function resolveFileUrl(stored) {
  if (!stored) return null;
  // Already a clean direct URL (no presigned params)
  if (stored.startsWith('http') && !stored.includes('X-Amz-')) {
    return stored;
  }
  // Old presigned URL — extract the key
  if (stored.startsWith('http')) {
    try {
      const u = new URL(stored);
      const key = u.pathname.replace(`/${MINIO_BUCKET}/`, '');
      return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
    } catch {
      return stored;
    }
  }
  // Plain key
  return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${stored}`;
}

async function deleteFromMinio(fileName) {
  try {
    await s3.deleteObject({ Bucket: MINIO_BUCKET, Key: fileName }).promise();
    console.log(`Deleted file ${fileName} from MinIO`);
  } catch (err) {
    console.error(`Failed to delete file ${fileName} from MinIO:`, err);
    throw err;
  }
}

module.exports = {
  s3,
  initializeMinIO,
  uploadToMinio,
  generatePresignedUrl,
  resolveFileUrl,
  deleteFromMinio
};