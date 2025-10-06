use crate::states::*;
use anchor_lang::prelude::*;
use crate::errors::ErrorState;
use crate::event::HospitalRegistered;

pub fn hospitals_register(ctx: Context<RegisterHospitals>, name: String, kms_ref: String) -> Result<()> {
    require!(name.len() <= MAX_NAME_LEN, ErrorState::InvalidArgs);
    require!(kms_ref.len() <= MAX_KMS_REF_LEN, ErrorState::InvalidArgs);

    let h = &mut ctx.accounts.hospital;
    h.authority = ctx.accounts.hospital_authority.key();
    h.name = name.clone();
    h.kms_ref = kms_ref.clone();
    h.registered_by = ctx.accounts.admin.key();
    h.created_at = Clock::get()?.unix_timestamp;
    h.bump = ctx.bumps.hospital;

    emit!(HospitalRegistered {
        hospital: h.key(),
        authority: h.authority,
        name,
        kms_ref,
        registered_by: h.registered_by,
        timestamp: h.created_at,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterHospitals<'info> {
    #[account(mut)]
    pub hospital_authority: Signer<'info>,

    #[account(
        constraint = !config.paused @ ErrorState::Paused
    )]
    pub config: Account<'info, Config>,

    #[account(
        constraint = admin.key() == config.authority @ ErrorState::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        init, 
        payer = hospital_authority,
        space = 8 + Hospital::INIT_SPACE,
        seeds = [SEED_HOSPITAL, hospital_authority.key().as_ref()],
        bump
    )]
    pub hospital: Account<'info, Hospital>,

    pub system_program: Program<'info, System>,
}