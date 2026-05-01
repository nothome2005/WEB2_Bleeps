const Minio = require('minio');

class StorageService {
  constructor() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT || 'localhost';
    const publicPort = parseInt(process.env.MINIO_PUBLIC_PORT || '9000', 10);
    this.publicMinioClient = new Minio.Client({
      endPoint: publicEndpoint,
      port: publicPort,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
    this.bucketName = process.env.MINIO_BUCKET || 'bleep-jobs';
  }

  async ensureBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
      }
    } catch (error) {
      console.error('Error ensuring MinIO bucket exists:', error);
    }
  }

  async getPresignedUrl(s3Key) {
    if (!s3Key) return null;
    try {
      // 1 hour expiry
      return await this.publicMinioClient.presignedGetObject(this.bucketName, s3Key, 60 * 60);
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return null;
    }
  }

  async getObjectText(s3Key) {
    if (!s3Key) return null;

    const stream = await this.minioClient.getObject(this.bucketName, s3Key);
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }
}

const storageService = new StorageService();

module.exports = {
  storageService,
};
