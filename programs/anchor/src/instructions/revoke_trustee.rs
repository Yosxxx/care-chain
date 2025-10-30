use crate::errors::TrusteeError;
use crate::event::TrusteeRevoked;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn trustee_revoke(ctx: Context<RevokeTrustee>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let trustee_acc = &mut ctx.accounts.trustee_account;

    require_keys_eq!(
        ctx.accounts.patient.key(),
        ctx.accounts.authority.key(),
        TrusteeError::Unauthorized
    );

    require!(!trustee_acc.revoked, TrusteeError::AlreadyRevoked);

    trustee_acc.revoked = true;
    trustee_acc.revoked_at = Some(now);

    emit!(TrusteeRevoked {
        trustee_account: trustee_acc.key(),
        patient: trustee_acc.patient,
        trustee: trustee_acc.trustee,
        revoked_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RevokeTrustee<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()],
        bump = patient.bump,
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        mut,
        seeds = [SEED_TRUSTEE, patient.key().as_ref(), trustee_account.trustee.as_ref()],
        bump = trustee_account.bump,
        constraint = !trustee_account.revoked @ TrusteeError::AlreadyRevoked
    )]
    pub trustee_account: Account<'info, Trustee>,

    pub system_program: Program<'info, System>,
}
