use crate::errors::VaultError;
use crate::states::VaultState;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
pub struct VaultOperations<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"state", user.key().as_ref(), mint.key().as_ref()],
        bump = vault_state.state_bump,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
impl<'info> VaultOperations<'info> {
    pub fn _deposit(&self, amount: u64) -> Result<()> {
        // Verify deposit amount is valid
        require!(amount > 0, VaultError::InvalidDepositAmount);

        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            mint: self.mint.to_account_info(),
            from: self.user_token_account.to_account_info(),
            to: self.vault.to_account_info(),
            authority: self.user.to_account_info(),
        };

        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_context, amount, self.mint.decimals)?;

        Ok(())
    }

    pub fn _withdraw(&self) -> Result<()> {
        // Verify target amount is reached
        require!(
            self.vault_state.target_amount <= self.vault.amount,
            VaultError::TargetAmountNotReached
        );

        let seeds = &[
            b"state",
            self.user.to_account_info().key.as_ref(),
            self.mint.to_account_info().key.as_ref(),
            &[self.vault_state.state_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            mint: self.mint.to_account_info(),
            from: self.vault.to_account_info(),
            to: self.user_token_account.to_account_info(),
            authority: self.vault_state.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_context, self.vault.amount, self.mint.decimals)?;

        Ok(())
    }
}
