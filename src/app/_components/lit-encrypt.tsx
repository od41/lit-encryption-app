"use client";
import { useEffect, useState } from "react";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { useAccount, useSignMessage } from "wagmi";

import { LitNetwork } from "@lit-protocol/constants";
import { uint8arrayToString } from "@lit-protocol/uint8arrays";

import { AuthCallbackParams } from "@lit-protocol/types";

import { useEthersProvider } from "./ethersProvider";
import { useEthersSigner } from "./ethersSigner";

import {
  LitAbility,
  createSiweMessageWithRecaps,
  LitAccessControlConditionResource,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { Signer } from "ethers";

const chain = "baseSepolia";

export default function LitEncryption() {
  const [file, setFile] = useState<File>();
  const [encryptedFile, setEncryptedFile] = useState<any>(null);
  const [litNodeClient, setLitNodeClient] = useState<LitJsSdk.LitNodeClient>();
  const { address } = useAccount();
  const signer = useEthersSigner();

  useEffect(() => {
    const initLitClient = async () => {
      try {
        const client = new LitJsSdk.LitNodeClient({
          litNetwork: LitNetwork.Cayenne,
        });
        await client.connect();
        setLitNodeClient(client);
        console.log("connected", litNodeClient);
      } catch (error) {
        console.error("error connecting client", error);
      }
    };

    initLitClient();
  }, []);

  const handleFileChange = (e: any) => {
    setFile(e.target.files[0]);
  };

  const getSessionSignatures = async () => {
    if (!file || !litNodeClient) return;
    // Get the latest blockhash
    const latestBlockhash = await litNodeClient.getLatestBlockhash();

    // Define the authNeededCallback function
    const authNeededCallback = async ({
      uri,
      expiration,
      resourceAbilityRequests,
    }: AuthCallbackParams) => {
      // Prepare the SIWE message for signing
      const toSign = await createSiweMessageWithRecaps({
        uri: uri!,
        expiration: expiration!,
        resources: resourceAbilityRequests!,
        walletAddress: address as string,
        nonce: latestBlockhash,
        litNodeClient: litNodeClient,
      });

      // Generate the authSig
      const authSig = await generateAuthSig({
        signer: signer as Signer,
        toSign,
      });

      return authSig;
    };

    // Define the Lit resource
    const litResource = new LitAccessControlConditionResource("*");

    // Get the session signatures
    const sessionSigs = await litNodeClient.getSessionSigs({
      chain: chain,
      resourceAbilityRequests: [
        {
          resource: litResource,
          ability: LitAbility.AccessControlConditionDecryption,
        },
      ],
      authNeededCallback,
      // capacityDelegationAuthSig,
    });
    return sessionSigs;
  };

  const accessControlConditions = [
    {
      contractAddress: "",
      standardContractType: "",
      chain,
      method: "eth_getBalance",
      parameters: [":userAddress", "latest"],
      returnValueTest: {
        comparator: ">=",
        value: "0",
      },
    },
  ];
  const encryptFile = async () => {
    if (!file || !litNodeClient) return;

    try {
      const sessionSigs = await getSessionSignatures();
      const fileResZip = await LitJsSdk.encryptFileAndZipWithMetadata({
        file,
        chain,
        accessControlConditions,
        sessionSigs: sessionSigs!,
        litNodeClient,
        readme: "decrypted by recipient",
      });

      // console.log("cipher", ciphertext);
      // console.log("dataToEncryptHash", dataToEncryptHash);
      const encryptedBlob = new Blob([fileResZip], { type: "text/plain" });
      const encryptedFile = new File([encryptedBlob], file.name);

      setEncryptedFile(encryptedFile);
    } catch (error) {
      console.error("error encrypting", error);
    }
    await litNodeClient.disconnect();
  };

  const decryptFile = async () => {
    if (!encryptedFile || !litNodeClient) return;

    try {
      const sessionSigs = await getSessionSignatures();

      console.log("sessionsigs", sessionSigs);
      console.log("encyrptmeta", encryptedFile);
      const dcRes = await LitJsSdk.decryptZipFileWithMetadata({
        file: encryptedFile,
        sessionSigs,
        litNodeClient,
      });

      const { decryptedFile, metadata } = dcRes!;

      console.log("decrypted file", decryptedFile);

      // const decryptedFile = new Blob(
      //   [uint8arrayToString(decryptedFileUint8, "utf8")],
      //   { endings: "transparent", type: "image/png" }
      // );

      // After we have our dcypted file we can download it
      const blob = new Blob([decryptedFile], {
        type: "application/octet-stream",
      });
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = metadata.name;
      downloadLink.click();

      // const url = URL.createObjectURL(decryptedFile);
      // const a = document.createElement("a");
      // a.href = url;
      // a.download = "decrypted_file";
      // a.click();
    } catch (error) {
      console.error("error decrypting", error);
    }

    await litNodeClient.disconnect();
  };

  const disconnect = () => {
    LitJsSdk.disconnectWeb3();
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={encryptFile}>Encrypt File</button>
      <button onClick={decryptFile}>Decrypt File</button>
      <div>
        <button onClick={disconnect}>disconnect</button>
      </div>
    </div>
  );
}
