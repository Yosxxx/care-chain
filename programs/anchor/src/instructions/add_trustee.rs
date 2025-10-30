use crate::states::*;
use anchor_lang::prelude::*;
use crate::event::TrusteeAdded;

pub fn trustee_add(ctx: Context<AddTrustee>) -> Result<()> {
    let acc = &mut ctx.accounts.trustee_account;
    acc.patient = ctx.accounts.patient.key();
    acc.trustee = ctx.accounts.trustee.key();
    acc.added_by = ctx.accounts.patient.key();
    acc.created_at = Clock::get()?.unix_timestamp;
    acc.revoked = false;
    acc.revoked_at = None;
    acc.bump = ctx.bumps.trustee_account;

    emit!(TrusteeAdded {
        patient: acc.patient,
        trustee: acc.trustee,
        added_at: acc.created_at,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct AddTrustee<'info> {
    #[account(mut)]
    pub patient: Signer<'info>,

    pub trustee: Signer<'info>,           // trustee wallet

    #[account(
        init_if_needed, 
        payer = patient, 
        space = 8 + Trustee::INIT_SPACE,
        seeds = [SEED_TRUSTEE, patient.key().as_ref(), trustee.key().as_ref()],
        bump)]
    pub trustee_account: Account<'info, Trustee>,           // on chain pda

    pub system_program: Program<'info, System>,
}
