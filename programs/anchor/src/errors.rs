use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorState {
    #[msg("Program is paused.")]
    Paused,
    #[msg("Unauthorized.")]
    Unauthorized,
    #[msg("Grant expired.")]
    GrantExpired,
    #[msg("Invalid Args.")]
    InvalidArgs,
}
