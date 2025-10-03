use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("CID too long")]
    CidTooLong,

    #[msg("Unauthorized action")]
    Unauthorized,
}
