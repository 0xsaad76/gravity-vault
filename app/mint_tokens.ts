import * as anchor from "@coral-xyz/anchor";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import {
  commitment,
  endpoint,
  mintAuthFilePath,
  loadKeypairFromFile,
} from "./utilities";

const connection: anchor.web3.Connection = new anchor.web3.Connection(
  endpoint,
  commitment
);

export async function mintTokens(
  mintAddress: anchor.web3.PublicKey,
  recipientAddress: anchor.web3.PublicKey,
  amount: number
) {
  try {
    const mintAuthority = loadKeypairFromFile(mintAuthFilePath);

    const aTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      mintAuthority,
      mintAddress,
      recipientAddress
    );

    const txn = await mintTo(
      connection,
      mintAuthority,
      mintAddress,
      aTokenAccount.address,
      mintAuthority.publicKey,
      amount
    );

    console.log(`Minted ${amount} tokens to ${aTokenAccount.address}`);
    console.log("Txn Signature:", txn);
  } catch (e) {
    console.error("Error minting tokens:", e);
  }
}
