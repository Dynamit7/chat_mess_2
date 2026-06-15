const AWS = require("aws-sdk");

// MinIO client configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.MINIO_ACCESS_KEY || "admin",
  secretAccessKey: process.env.MINIO_SECRET_KEY || "strongpassword123",
  // endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
  // localhost версия:
  endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9002",
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

// Initialize bucket and set policy
async function initializeMinIO() {
  const bucketName = "my-bucket";
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

  // Set bucket policy for read and write access
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
    await s3
      .putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy),
      })
      .promise();
    console.log(`Set policy for bucket ${bucketName}`);
  } catch (err) {
    console.error("Error setting bucket policy:", err);
  }
}

// Run initialization
initializeMinIO().catch((err) => console.error("MinIO initialization failed:", err));

// Function to upload file to MinIO
async function uploadToMinio(fileBuffer, fileName, mimeType) {
  console.log(`Uploading ${fileName} with MIME type: ${mimeType || "undefined"}`);
  const params = {
    Bucket: "my-bucket",
    Key: fileName,
    Body: fileBuffer,
  };
  try {
    await s3.putObject(params).promise();
    console.log(`Successfully uploaded ${fileName} to my-bucket`);
  } catch (err) {
    console.error(`Failed to upload ${fileName}:`, err);
    throw err;
  }
}

// Function to generate presigned URL
function generatePresignedUrl(fileName, mimeType = "application/octet-stream") {
  const params = {
    Bucket: "my-bucket",
    Key: fileName,
    Expires: 60 * 60, // 1 hour
  };
  console.log(`Generating presigned URL for ${fileName} with MIME type: ${mimeType}`);
  try {
    const signedUrl = s3.getSignedUrl("getObject", params);
    // return signedUrl.replace("http://minio:9000", "https://minio.polat.digital");
    // localhost версия:
    return signedUrl.replace("http://minio:9000", "http://localhost:9002");
  } catch (err) {
    console.error(`Failed to generate presigned URL for ${fileName}:`, err);
    throw err;
  }
}

module.exports = { uploadToMinio, generatePresignedUrl };