import 'server-only';
import * as b2Storage from './b2';

export interface StorageProvider {
  mintPresignedPut(
    bucket: string,
    key: string,
    contentType: string,
    ttlSeconds?: number
  ): Promise<string>;
  mintPresignedGet(
    bucket: string,
    key: string,
    ttlSeconds?: number
  ): Promise<string>;
  putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<void>;
  headObject(
    bucket: string,
    key: string
  ): Promise<{ contentLength: number; contentType?: string }>;
  copyObject(
    bucket: string,
    sourceKey: string,
    destKey: string
  ): Promise<void>;
  copyObjectPublic(
    bucket: string,
    sourceKey: string,
    destKey: string,
    contentType: string
  ): Promise<void>;
  publicObjectUrl(bucket: string, key: string): string;
  deleteObject(bucket: string, key: string): Promise<void>;
  streamAndVerify(
    bucket: string,
    key: string
  ): Promise<{
    contentLength: number;
    contentType?: string;
    sha256: string;
    magicValid: boolean;
  }>;
}

export const storageProvider: StorageProvider = {
  mintPresignedPut: b2Storage.mintPresignedPut,
  mintPresignedGet: b2Storage.mintPresignedGet,
  putObject: b2Storage.putObject,
  headObject: b2Storage.headObject,
  copyObject: b2Storage.copyObject,
  copyObjectPublic: b2Storage.copyObjectPublic,
  publicObjectUrl: b2Storage.publicObjectUrl,
  deleteObject: b2Storage.deleteObject,
  streamAndVerify: b2Storage.streamAndVerify,
};

export default storageProvider;
