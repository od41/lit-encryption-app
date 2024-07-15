"use client";
import { useState } from "react";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { useAccount } from "wagmi";

import { LitNetwork } from "@lit-protocol/constants";
import { uint8arrayToString } from "@lit-protocol/uint8arrays";

export default function LitEncryption() {
  const [file, setFile] = useState(null);
  const [encryptedFile, setEncryptedFile] = useState<any>(null);
  const { address } = useAccount();

  const handleFileChange = (e: any) => {
    setFile(e.target.files[0]);
  };

  const encryptFile = async () => {
    if (!file) return;

    const litNodeClient = new LitJsSdk.LitNodeClient({
      litNetwork: LitNetwork.DatilDev,
    });
    await litNodeClient.connect();

    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "baseGoerli",
      nonce: "1",
    });

    const accessControlConditions = [
      {
        contractAddress: "",
        standardContractType: "",
        chain: "baseGoerli",
        method: "eth_getBalance",
        parameters: [":userAddress", "latest"],
        returnValueTest: {
          comparator: ">=",
          value: "0",
        },
      },
    ];

    const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptFile(
      { file, chain: "baseGoerli", accessControlConditions, authSig },
      litNodeClient
    );

    setEncryptedFile({
      ciphertext,
      dataToEncryptHash,
      accessControlConditions,
    });
  };

  const decryptFile = async () => {
    if (!encryptedFile) return;

    const litNodeClient = new LitJsSdk.LitNodeClient({
      litNetwork: LitNetwork.DatilDev,
    });
    await litNodeClient.connect();

    const authSig = await LitJsSdk.checkAndSignAuthMessage({
      chain: "baseGoerli",
      nonce: "2",
    });

    const decryptedFileUint8 = await LitJsSdk.decryptToFile(
      {
        ciphertext: encryptedFile.ciphertext,
        dataToEncryptHash: encryptedFile.dataToEncryptHash,
        chain: "baseGoerli",
      },
      litNodeClient
    );

    const decryptedFile = new Blob([
      uint8arrayToString(decryptedFileUint8, "utf8"),
    ]);

    const url = URL.createObjectURL(decryptedFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decrypted_file";
    a.click();
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={encryptFile}>Encrypt File</button>
      <button onClick={decryptFile}>Decrypt File</button>
    </div>
  );
}
