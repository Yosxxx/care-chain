use anchor_lang::prelude::*;
use crate::{error::CustomError, states::{RecordData, AuthorityBadge}};

pub fn handle(ctx: Context<AddMedicalRecordAccounts>, cid: String) -> Result<()> {
    // Optional: bound check to keep account size safe
    require!(cid.len() <= RecordData::MAX_CID, CustomError::CidTooLong);

    let record = &mut ctx.accounts.record;
    record.patient   = ctx.accounts.patient.key();
    record.authority = ctx.accounts.authority.key();
    record.cid       = cid;
    record.timestamp = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct AddMedicalRecordAccounts<'info>{
    /// Patient (no signature needed)
    pub patient: UncheckedAccount<'info>,
    
    /// PDA that proves the signer is an approved authority
    #[account(
        seeds = [b"auth", authority.key().as_ref()],
        bump,
        has_one = authority,
    )]
    pub authority_badge: Account<'info, AuthorityBadge>,

    /// The signer/payer (hospital or Kemenkes wallet)
    #[account(mut)]
    pub authority: Signer<'info>,

    // Medical Record PDA
    #[account(
        init,
        payer = authority,
        space = 8 + RecordData::MAX_SIZE,
        seeds = [b"record", patient.key().as_ref(), authority.key().as_ref()],
        bump,
    )]
    pub record: Account<'info, RecordData>,

    // System Program
    pub system_program: Program<'info, System>,

}