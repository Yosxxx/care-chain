use crate::errors::ConfigError;
use crate::event::ProgramPauseUpdated;
use crate::states::*;
use anchor_lang::prelude::*;

pub fn paused_set(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    let cfg = &mut ctx.accounts.config;

    if cfg.paused == paused {
        return Ok(());
    }

    cfg.paused = paused;

    emit!(ProgramPauseUpdated {
        paused,
        set_by: ctx.accounts.authority.key(),
        at: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump = config.bump,
        has_one = authority @ ConfigError::UnauthorizedPauseAction
    )]
    pub config: Account<'info, Config>,
}
