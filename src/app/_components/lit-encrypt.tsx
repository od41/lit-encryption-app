"use client";
import { useEffect, useState } from "react";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { useAccount, useSignMessage } from "wagmi";

import { LitNetwork } from "@lit-protocol/constants";
import { uint8arrayToString } from "@lit-protocol/uint8arrays";

import {
  AuthCallbackParams,
  AuthSig,
  SessionSigsMap,
} from "@lit-protocol/types";

import {
  LitAbility,
  createSiweMessageWithRecaps,
  LitAccessControlConditionResource,
} from "@lit-protocol/auth-helpers";

const chain = "baseSepolia";

export default function LitEncryption() {
  const [file, setFile] = useState(null);
  const [encryptedFile, setEncryptedFile] = useState<any>(null);
  const [litNodeClient, setLitNodeClient] = useState<LitJsSdk.LitNodeClient>();
  const [sessionSigs, setSessionSigs] = useState<SessionSigsMap>();
  const { address } = useAccount();
  const { signMessage } = useSignMessage();

  useEffect(() => {
    const initLitClient = async () => {
      try {
        const client = new LitJsSdk.LitNodeClient({
          litNetwork: LitNetwork.DatilDev,
        });
        await client.connect();
        setLitNodeClient(client);
      } catch (error) {
        console.error("error setting session sigs", error);
      }
    };

    initLitClient();
  }, []);

  useEffect(() => {
    if (litNodeClient) {
      const initSessionSigs = async () => {
        try {
          const _sessionSigs = await litNodeClient.getSessionSigs({
            chain,
            resourceAbilityRequests: [
              {
                resource: new LitAccessControlConditionResource("someResource"),
                ability: LitAbility.AccessControlConditionDecryption,
              },
            ],
            switchChain: true,
            authNeededCallback,
          });
          setSessionSigs(_sessionSigs);
        } catch (error) {
          console.error("error setting session sigs", error);
        }
      };

      initSessionSigs();
    }
  }, [litNodeClient]);

  const handleFileChange = (e: any) => {
    setFile(e.target.files[0]);
  };

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
      nonce: await litNodeClient!.getLatestBlockhash(),
      litNodeClient: litNodeClient,
    });
    // Use the Ethereum wallet to sign the message, return the digital signature
    const signature = await signMessage({ message: toSign });

    // Create an AuthSig using the derived signature, the message, and wallet address
    const authSig: AuthSig = {
      sig: signature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: toSign,
      address: address as string,
    };

    return authSig;
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
      const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptFile(
        { file, chain, accessControlConditions, sessionSigs },
        litNodeClient
      );

      console.log("cipher", ciphertext);
      console.log("dataToEncryptHash", dataToEncryptHash);

      setEncryptedFile({
        ciphertext,
        dataToEncryptHash,
      });
    } catch (error) {
      console.error("error encrypting", error);
    }
    litNodeClient.disconnect();
  };

  const decryptFile = async () => {
    if (!encryptedFile || !litNodeClient) return;

    try {
      const decryptedFileUint8 = await LitJsSdk.decryptToFile(
        {
          ciphertext: encryptedFile.ciphertext,
          dataToEncryptHash: encryptedFile.dataToEncryptHash,
          accessControlConditions,
          sessionSigs,
          chain,
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
    } catch (error) {
      console.error("error decrypting", error);
    }

    litNodeClient.disconnect();
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={encryptFile}>Encrypt File</button>
      <button onClick={decryptFile}>Decrypt File</button>
    </div>
  );
}
