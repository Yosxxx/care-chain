use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::ConfigError;
use crate::event::ConfigInitialized;

pub fn config_init(ctx: Context<InitConfig>, kms_namespace: String) -> Result<()> {
    let ns = kms_namespace.trim();
    require!(!ns.is_empty(), ConfigError::EmptyKmsNamespace);
    require!(
        ns.len() <= MAX_KMS_REF_LEN,
        ConfigError::KmsNamespaceTooLong
    );

    let cfg = &mut ctx.accounts.config;
    cfg.authority = ctx.accounts.authority.key();
    cfg.paused = false;
    cfg.kms_namespace = ns.to_string();
    cfg.bump = ctx.bumps.config;

    emit!(ConfigInitialized {
        authority: cfg.authority,
        kms_namespace: cfg.kms_namespace.clone(),
        created_at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(
        init, 
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}