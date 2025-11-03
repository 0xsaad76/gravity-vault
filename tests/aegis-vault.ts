import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AegisVault } from "../target/types/gravity_vault";
import {
  Account,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import { requestAirdrop } from "./utilities";

describe("aegis-vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.aegisVault as Program<AegisVault>;

  let user: anchor.web3.Keypair;
  let mint: anchor.web3.PublicKey;
  let vaultStatePda: anchor.web3.PublicKey;
  let vaultPda: anchor.web3.PublicKey;
  let userAta: Account;

  const targetAmount = 15_000_000;
  const depositAmount = 30_000_000;
  const mintAmount = 45_000_000;

  before(async () => {
    user = anchor.web3.Keypair.generate();

    await requestAirdrop(provider.connection, user);

    mint = await createMint(
      provider.connection,
      user,
      user.publicKey,
      user.publicKey,
      6
    );

    [vaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    await mintTo(
      provider.connection,
      user,
      mint,
      userAta.address,
      user,
      mintAmount
    );
  });

  it("should initialize a vault", async () => {
    const txn = await program.methods
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

    console.log("> Initialize vault. Txn signature:", txn);
    console.log("> Vault address:", vaultPda.toBase58());

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    const vaultAccount = await getAccount(provider.connection, vaultPda);

    expect(vaultState.targetAmount.toString()).to.equal(
      targetAmount.toString()
    );
    expect(vaultState.tokenMint.toString()).to.equal(mint.toString());
    expect(vaultAccount.amount.toString()).to.equal("0");
    expect(vaultAccount.mint.toString()).to.equal(mint.toString());
  });

  it("should deposit tokens", async () => {
    const userBalanceBefore = await getAccount(
      provider.connection,
      userAta.address
    );

    const txn = await program.methods
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

    console.log("> Deposit tokens. Txn signature:", txn);

    const vaultAccount = await getAccount(provider.connection, vaultPda);
    const userAccount = await getAccount(provider.connection, userAta.address);

    expect(vaultAccount.amount.toString()).to.equal(depositAmount.toString());
    expect(userAccount.amount.toString()).to.equal(
      (Number(userBalanceBefore.amount) - depositAmount).toString()
    );
  });

  it("should reject invalid deposit amount", async () => {
    try {
      await program.methods
        .deposit(new anchor.BN(0))
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

      expect.fail("Should have thrown an error");
    } catch (err) {
      const anchorError = err as anchor.AnchorError;
      expect(anchorError.error.errorCode.code).to.equal("InvalidDepositAmount");
    }
  });

  it("should withdraw tokens", async () => {
    const vaultBalanceBefore = await getAccount(provider.connection, vaultPda);
    const userBalanceBefore = await getAccount(
      provider.connection,
      userAta.address
    );

    const txn = await program.methods
      .withdraw()
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

    console.log("> Withdraw tokens. Txn signature:", txn);

    const vaultAccount = await getAccount(provider.connection, vaultPda);
    const userAccount = await getAccount(provider.connection, userAta.address);

    expect(vaultAccount.amount.toString()).to.equal("0");
    expect(userAccount.amount.toString()).to.equal(
      (
        Number(userBalanceBefore.amount) + Number(vaultBalanceBefore.amount)
      ).toString()
    );
  });
});
