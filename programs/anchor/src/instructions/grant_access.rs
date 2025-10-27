use crate::errors::AccessError;
use crate::event::GrantCreated;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn access_grant(
    ctx: Context<GrantAccess>,
    scope: u8,
    duration_sec: Option<i64>, // CHANGED: This is now a duration, not an absolute time
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.patient.patient_pubkey,
        ctx.accounts.authority.key(),
        AccessError::UnauthorizedGrant
    );

    let allowed = SCOPE_READ | SCOPE_WRITE | SCOPE_ADMIN;
    require!(scope != 0 && (scope & !allowed) == 0, AccessError::InvalidScope);

    let now = Clock::get()?.unix_timestamp;

    // --- LOGIC FLIPPED ---
    // 1. We now receive a duration, not an absolute timestamp.
    // 2. We calculate the absolute expires_at timestamp on-chain.
    let final_expires_at: Option<i64> = if let Some(duration) = duration_sec {
        // 3. The duration must be a positive number of seconds.
        require!(duration > 0, AccessError::BadExpiry);
        // 4. Calculate the final absolute time.
        Some(now + duration)
    } else {
        // None means the grant is permanent (never expires).
        None
    };
    // --- END OF CHANGE ---

    let grant = &mut ctx.accounts.grant;
    grant.patient = ctx.accounts.patient.key();
    grant.grantee = ctx.accounts.grantee.key();
    grant.scope = scope;
    grant.expires_at = final_expires_at; // CHANGED: Store the calculated absolute time

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
        expires_at: final_expires_at, // CHANGED: Emit the calculated absolute time
        created_by: grant.created_by,
        created_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(scope: u8, duration_sec: Option<i64>)] // CHANGED: Renamed from expires_at
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

    pub system_program: Program<'info, System>,
}
