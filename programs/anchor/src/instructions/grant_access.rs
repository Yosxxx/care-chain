use crate::errors::AccessError;
use crate::event::GrantCreated;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn access_grant(
    ctx: Context<GrantAccess>,
    scope: u8,
    expires_at: Option<i64>,
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.patient.patient_pubkey,
        ctx.accounts.authority.key(),
        AccessError::UnauthorizedGrant
    );

    let allowed = SCOPE_READ | SCOPE_WRITE | SCOPE_ADMIN;
    require!(scope != 0 && (scope & !allowed) == 0, AccessError::InvalidScope);

    let now = Clock::get()?.unix_timestamp;
    if let Some(exp) = expires_at {
        require!(exp > now, AccessError::BadExpiry);
    }

    let grant = &mut ctx.accounts.grant;
    grant.patient = ctx.accounts.patient.key();
    grant.grantee = ctx.accounts.grantee.key();
    grant.scope = scope;
    grant.expires_at = expires_at;

    grant.created_by = ctx.accounts.authority.key();
    grant.created_at = now;

    grant.revoked = false;
    grant.revoked_at = None;

    grant.bump = ctx.bumps.grant;

    emit!(GrantCreated {
        grant: grant.key(),
        patient: grant.patient,
        grantee: grant.grantee,
        scope,
        expires_at,
        created_by: grant.created_by,
        created_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(scope: u8, expires_at: Option<i64>)]
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
        init,
        payer = authority, 
        space = 8 + Grant::INIT_SPACE,
        seeds = [SEED_GRANT, patient.key().as_ref(), grantee.key().as_ref(), &[scope]],
        bump
    )]
    pub grant: Account<'info, Grant>,
    pub grantee: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}
