use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::ErrorState;

pub fn config_init(ctx: Context<InitConfig>, kms_namespace: String) -> Result<()> {
    require!(
        kms_namespace.len() <= MAX_KMS_REF_LEN,
        ErrorState::InvalidArgs
    );

    let cfg: &mut Account<'_, Config> = &mut ctx.accounts.config;

    cfg.authority = ctx.accounts.authority.key();
    cfg.paused = false;

    cfg.kms_namespace = kms_namespace;
    cfg.bump = ctx.bumps.config;
    
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