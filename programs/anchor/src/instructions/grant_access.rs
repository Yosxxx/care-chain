use crate::errors::{AccessError, TrusteeError};
use crate::event::{GrantCreated, TrusteeGrantCreated};
use crate::states::*;
use anchor_lang::prelude::*;

pub fn access_grant(ctx: Context<GrantAccess>, scope: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let authority = ctx.accounts.authority.key();
    let patient_pk = ctx.accounts.patient.patient_pubkey;

    let is_patient = authority == patient_pk;
    let is_trustee = ctx.accounts.trustee_account.is_some();

    require!(is_patient || is_trustee, AccessError::UnauthorizedGrant);

    if is_trustee {
        require!(scope == SCOPE_READ, TrusteeError::ReadOnly);
    }

    let allowed = SCOPE_READ | SCOPE_WRITE | SCOPE_ADMIN;
    require!(
        scope != 0 && (scope & !allowed) == 0,
        AccessError::InvalidScope
    );

    let grant = &mut ctx.accounts.grant;
    grant.patient = ctx.accounts.patient.key();
    grant.grantee = ctx.accounts.grantee.key();
    grant.scope = scope;

    grant.created_by = ctx.accounts.authority.key();
    grant.created_at = now;

    grant.revoked = false;
    grant.revoked_at = None;

    grant.bump = ctx.bumps.grant;

    if is_trustee {
        emit!(TrusteeGrantCreated {
            grant: grant.key(),
            patient: grant.patient,
            grantee: grant.grantee,
            trustee: authority,
            scope,
            created_at: now,
        });
    } else {
        emit!(GrantCreated {
            grant: grant.key(),
            patient: grant.patient,
            grantee: grant.grantee,
            scope,
            created_by: authority,
            created_at: now,
        });
    }

    Ok(())
}

#[derive(Accounts)]
#[instruction(scope: u8)]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = !config.paused @ AccessError::Paused
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [SEED_PATIENT, patient.patient_pubkey.as_ref()],
        bump = patient.bump,
    )]
    pub patient: Account<'info, Patient>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Grant::INIT_SPACE,
        seeds = [SEED_GRANT, patient.key().as_ref(), grantee.key().as_ref(), &[scope]],
        bump
    )]
    pub grant: Account<'info, Grant>,
    pub grantee: SystemAccount<'info>,

    #[account(
        seeds = [SEED_TRUSTEE, patient.patient_pubkey.key().as_ref(), authority.key().as_ref()],
        bump = trustee_account.bump,
        constraint = !trustee_account.revoked @ TrusteeError::Revoked
    )]
    pub trustee_account: Option<Account<'info, Trustee>>,

    pub system_program: Program<'info, System>,
}
