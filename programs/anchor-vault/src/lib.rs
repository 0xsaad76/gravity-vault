#![allow(unexpected_cfgs)]
// #![allow(deprecated)]

use anchor_lang::{ prelude::{ * }, system_program::{ Transfer, transfer } };

declare_id!("98kSHXMAd3SWj816PVKUeV38PUZ28ZtzTyPSJ1BGLTqV");

#[program]
pub mod anchor_vault {
    use super::*;

    // this will act as entry point for the program
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(ctx.bumps)?;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposits>, amount: u64) -> Result<()> {
        ctx.accounts.deposit(amount)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        ctx.accounts.withdraw(amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)] // the below signer must a mut account because the program will be deducted the lamports for rent
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        seeds = [b"vaultstate", user.key().as_ref()], // pda created for each unique user adderss
        bump,
        space = 8 + VaultState::INIT_SPACE
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        mut,
        seeds = [b"vaultstate", vault.key().as_ref()], // vault state pda will then be used to transfer the lamports to the user address
        bump
    )] // note: here we cant use the init in system accoutn, because as soon the rent ammount comes in the system account is initialized
    pub vault: SystemAccount<'info>, // System Account because it will not store any data but only lamports
    pub system_program: Program<'info, System>, // this field is mandatory because system program is one responsible for initializing the above 3 accounts
}

impl<'info> Initialize<'info> {
    // the below initialize function basically transfer the rent lamports from user to the vault program during the program initialization
    pub fn initialize(&mut self, bumps: InitializeBumps) -> Result<()> {
        let rent_exempt = Rent::get()?.minimum_balance(
            self.vault_state.to_account_info().data_len()
        );

        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, rent_exempt)?;

        self.vault_state.vault_bump = bumps.vault;
        self.vault_state.state_bump = bumps.vault_state;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposits<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(
        mut,
        seeds = [b"state", user.key().as_ref()],
        bump = vault_state.state_bump,
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(mut, seeds = [b"vault", vault_state.key().as_ref()], bump = vault_state.vault_bump)]
    pub vault: SystemAccount<'info>,
}

impl<'info> Deposits<'info> {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to: self.vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(seeds = [b"state", user.key().as_ref()], bump = vault_state.state_bump)]
    pub vault_state: Account<'info, VaultState>,
    #[account(mut, seeds = [b"vault", vault_state.key().as_ref()], bump = vault_state.vault_bump)]
    pub vault: SystemAccount<'info>,
}

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        // check that the withdraw is more the deposits + rent_exempt lamports amount

        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.vault.to_account_info(),
            to: self.user.to_account_info(),
        };

        let seeds = &[
            b"vault".as_ref(),
            self.vault_state.to_account_info().key.as_ref(),
            &[self.vault_state.vault_bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub state_bump: u8, // saving the bumps to save the cost on bump creation on every iteration
    pub vault_bump: u8,
}

// impl Space for VaultState {
//     const INIT_SPACE: usize = 8 + 1 + 1; // 8: account default size for discrimator in sol | 1 : size of state_pump | 1 : size of vault_bump
// }
