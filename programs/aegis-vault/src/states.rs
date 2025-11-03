use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub target_amount: u64,
    pub vault_bump: u8,
    pub state_bump: u8,
    pub token_mint: Pubkey,
}
