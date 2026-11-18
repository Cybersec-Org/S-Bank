import { createSign, createVerify, generateKeyPairSync } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface TransferConfirmationPayload {
  operationNumber: string;
  senderIban: string;
  receiverIban: string;
  amount: number;
  currency: string;
  executedAt: string;
}

@Injectable()
export class SignatureService {
  private readonly keyId = 'sbank-hsm-key-p256-v1';
  private readonly algorithm = 'ECDSA-P256-SHA256';

  private readonly keyPair = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  getPublicKeyInfo() {
    return {
      keyId: this.keyId,
      algorithm: this.algorithm,
      provider: process.env['PKCS11_MODULE_PATH'] ? 'SoftHSM2-PKCS11' : 'Software-HSM-Fallback',
      publicKeyPem: this.keyPair.publicKey,
    };
  }

  signTransferConfirmation(payload: TransferConfirmationPayload): string {
    const canonicalString = JSON.stringify({
      operationNumber: payload.operationNumber,
      senderIban: payload.senderIban,
      receiverIban: payload.receiverIban,
      amount: payload.amount,
      currency: payload.currency,
      executedAt: payload.executedAt,
    });

    const signer = createSign('SHA256');
    signer.update(canonicalString);
    signer.end();

    return signer.sign(this.keyPair.privateKey, 'base64');
  }

  verifyTransferConfirmation(payload: TransferConfirmationPayload, signatureBase64: string): boolean {
    try {
      const canonicalString = JSON.stringify({
        operationNumber: payload.operationNumber,
        senderIban: payload.senderIban,
        receiverIban: payload.receiverIban,
        amount: payload.amount,
        currency: payload.currency,
        executedAt: payload.executedAt,
      });

      const verifier = createVerify('SHA256');
      verifier.update(canonicalString);
      verifier.end();

      return verifier.verify(this.keyPair.publicKey, signatureBase64, 'base64');
    } catch {
      return false;
    }
  }
}