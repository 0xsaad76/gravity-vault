use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Deposit amount is invalid")]
    InvalidDepositAmount,

    #[msg("Target amount is not reached yet")]
    TargetAmountNotReached,
}
