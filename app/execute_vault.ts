import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  commitment,
  endpoint,
  getOrCreateMintAuthority,
  mintAddress,
  requestAirdrop,
} from "./utilities";
import { mintTokens } from "./mint_tokens";
import idl from "../target/idl/gravity_vault.json";
import { AegisVault } from "../target/types/gravity_vault";

const connection: Connection = new Connection(endpoint, commitment);
const aegisVaultInterface = JSON.parse(JSON.stringify(idl));
const mint = new PublicKey(mintAddress);

(async function executeVault() {
  const mintAmount = 1_000_000_000;
  const targetAmount = 50_000_000;
  const depositAmount = 75_000_000;

  try {
    const user = getOrCreateMintAuthority();
    console.log("User:", user.publicKey.toBase58());

    await requestAirdrop(connection, user);

    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(user),
      { preflightCommitment: commitment }
    );

    const program = new anchor.Program(
      aegisVaultInterface,
      provider
    ) as anchor.Program<AegisVault>;

    const [vaultStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("state"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    console.log("Vault State PDA:", vaultStatePda.toBase58());
    console.log("Vault PDA:", vaultPda.toBase58());

    const userAta = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      mint,
      user.publicKey
    );

    console.log("User ATA:", userAta.address.toBase58());
    console.log("> Minting tokens to user...");
    await mintTokens(mint, user.publicKey, mintAmount);

    let vaultExists = false;
    try {
      await program.account.vaultState.fetch(vaultStatePda);
      vaultExists = true;
      console.log("Vault already initialized. Ignore...");
    } catch (e) {
      console.log("Vault not found, initializing...");
    }

    // Initialize vault
    if (!vaultExists) {
      console.log("> Initializing vault...");
      const initVaultTxn = await program.methods
        .initialize(new anchor.BN(targetAmount))
        .accountsStrict({
          user: user.publicKey,
          mint: mint,
          vaultState: vaultStatePda,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Initialize vault. Txn:", initVaultTxn);
    }

    // Deposit tokens
    console.log("> Depositing tokens...");
    const depositTxn = await program.methods
      .deposit(new anchor.BN(depositAmount))
      .accountsStrict({
        user: user.publicKey,
        mint: mint,
        userTokenAccount: userAta.address,
        vaultState: vaultStatePda,
        vault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("Deposit Txn:", depositTxn);

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    console.log("> Target Amount:", vaultState.targetAmount.toString());
    console.log("> Token Mint:", vaultState.tokenMint.toBase58());

    console.log("> Vault execution complete!");
  } catch (e) {
    console.error("Error executing vault:", e);
  }
})();