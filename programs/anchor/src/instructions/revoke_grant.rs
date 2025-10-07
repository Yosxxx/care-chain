use crate::errors::AccessError;
use crate::event::GrantRevoked;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn grant_revoke(ctx: Context<RevokeGrant>) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.patient.patient_pubkey,
        ctx.accounts.authority.key(),
        AccessError::UnauthorizedRevoke
    );

    let grant = &mut ctx.accounts.grant;
    require!(!grant.revoked, AccessError::AlreadyRevoked);

    grant.revoked = true;
    grant.revoked_at = Some(Clock::get()?.unix_timestamp);

    emit!(GrantRevoked {
        grant: grant.key(),
        patient: grant.patient,
        grantee: grant.grantee,
        scope: grant.scope,
        revoked_by: ctx.accounts.authority.key(),
        revoked_at: grant.revoked_at.unwrap(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RevokeGrant<'info> {
    #[account(
        seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()],
        bump = patient.bump
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        mut,
        seeds = [SEED_GRANT, patient.key().as_ref(), grantee.key().as_ref(), &[grant.scope]],
        bump = grant.bump,
        constraint = grant.patient == patient.key() @ AccessError::UnauthorizedRevoke
    )]
    pub grant: Account<'info, Grant>,

    pub grantee: SystemAccount<'info>,

    pub authority: Signer<'info>,
}
