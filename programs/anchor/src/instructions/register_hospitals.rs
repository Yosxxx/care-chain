use crate::errors::HospitalError;
use crate::event::HospitalRegistered;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn hospitals_register(
    ctx: Context<RegisterHospitals>,
    name: String,
    kms_ref: String,
) -> Result<()> {
    let name_trim = name.trim();
    require!(!name_trim.is_empty(), HospitalError::EmptyName);
    require!(name_trim.len() <= MAX_NAME_LEN, HospitalError::NameTooLong);

    let kms_trim = kms_ref.trim();
    require!(!kms_trim.is_empty(), HospitalError::EmptyKmsRef);
    require!(
        kms_trim.len() <= MAX_KMS_REF_LEN,
        HospitalError::KmsRefTooLong
    );

    let now = Clock::get()?.unix_timestamp;
    let hospital = &mut ctx.accounts.hospital;

    hospital.authority = ctx.accounts.hospital_authority.key();
    hospital.name = name_trim.to_string();
    hospital.kms_ref = kms_trim.to_string();
    hospital.registered_by = ctx.accounts.registrar.key();
    hospital.created_at = now;
    hospital.bump = ctx.bumps.hospital;

    emit!(HospitalRegistered {
        hospital: hospital.key(),
        hospital_authority: hospital.authority,
        name: hospital.name.clone(),
        kms_ref: hospital.kms_ref.clone(),
        registered_by: hospital.registered_by,
        created_at: now,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct RegisterHospitals<'info> {
    #[account(mut)]
    pub registrar: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump = config.bump,
        constraint = config.authority == registrar.key() @ HospitalError::UnauthorizedRegistrar,
        constraint = !config.paused @ HospitalError::Paused
    )]
    pub config: Account<'info, Config>,

    pub hospital_authority: SystemAccount<'info>,

    #[account(
        init,
        payer = registrar,
        space = 8 + Hospital::INIT_SPACE,
        seeds = [SEED_HOSPITAL, hospital_authority.key().as_ref()],
        bump
    )]
    pub hospital: Account<'info, Hospital>,

    pub system_program: Program<'info, System>,
}
