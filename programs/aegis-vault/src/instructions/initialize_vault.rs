use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::states::VaultState;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = user,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"state", user.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = user,
        seeds = [b"vault", user.key().as_ref(), mint.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault_state,
        token::token_program = token_program,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
impl<'info> InitializeVault<'info> {
    pub fn _init_vault(
        &mut self,
        target_amount: u64,
        mint_pubkey: Pubkey,
        bumps: InitializeVaultBumps,
    ) -> Result<()> {
        self.vault_state.set_inner(VaultState {
            target_amount: target_amount,
            vault_bump: bumps.vault,
            state_bump: bumps.vault_state,
            token_mint: mint_pubkey,
        });

        Ok(())
    }
}
