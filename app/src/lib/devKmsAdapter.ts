import { KmsAdapter, KmsContext } from "./kmsAdapter";

export class DevKmsAdapter implements KmsAdapter {
  readonly keyRef = "dev-kek";

  async encryptKey(dek: Uint8Array, _ctx?: KmsContext): Promise<Uint8Array> {
    return dek; // No encryption (mock)
  }

  async decryptKey(wrapped: Uint8Array, _ctx?: KmsContext): Promise<Uint8Array> {
    return wrapped; // No decryption (mock)
  }
}
