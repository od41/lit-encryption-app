"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import LitEncryption from "./_components/lit-encrypt";
import { useAccount } from "wagmi";

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <div>
      <ConnectButton />
      {isConnected && <LitEncryption />}
    </div>
  );
}
