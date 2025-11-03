import {
  clusterApiUrl,
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";

export const tokenMetadata = {
  name: "Nova",
  symbol: "NVA",
  uri: "https://red-rainy-koi-23.mypinata.cloud/ipfs/bafkreiat3atebtv7budwci77eul3hjjikptqxrh7z3tzqjzllrfhdiyvai",
};

export const mintAuthFilePath = "./mint_authority.json";
export const userFilePath = "./user_keypair.json";
export const endpoint: string = clusterApiUrl("devnet");
export const commitment: Commitment = "confirmed";
export const mintAddress = "AYcQZZoTx9rPMNeRDJwhUF7aK7ZMCRhpbZoLcjW4bTtH";

export function getMintAuthority(): Keypair {
  const secret = process.env.MINT_AUTHORITY_SECRET;

  if (secret && secret.trim() !== "") {
    try {
      const secretKey = bs58.decode(secret.trim());
      const keypair = Keypair.fromSecretKey(secretKey);
      console.log("Loaded mint authority from .env");
      return keypair;
    } catch (err) {
      console.error("Invalid secret in .env — creating new keypair");
    }
  }

  const newKeypair = Keypair.generate();
  console.log("No secret found. Generated new mint authority keypair.");
  return newKeypair;
}

export function loadKeypairFromFile(secretFilePath: string) {
  const secret = JSON.parse(fs.readFileSync(secretFilePath, "utf-8"));
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}

export async function requestAirdrop(connection: Connection, keypair: Keypair) {
  const balance = await checkBalance(connection, keypair);
  if (balance < 1.0) {
    console.log("> You do not have enough funds. Requesting airdrop...");
    try {
      const txn = await connection.requestAirdrop(
        keypair.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(txn, "confirmed");
      console.log(`Airdrop to ${keypair.publicKey} is successful`);
    } catch (e) {
      console.log("Airdrop request failed:", e);
    }
  } else {
    console.log("> You have enough funds to continue");
  }
}

export async function checkBalance(
  connection: Connection,
  keypair: Keypair
): Promise<number> {
  const lamportsBalance = await connection.getBalance(keypair.publicKey);
  const solBalance = lamportsBalance / LAMPORTS_PER_SOL;
  console.log(solBalance);
  return solBalance;
}
