import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest, CliApiError } from '../lib/api.js';

/**
 * `serront billing` — the workspace's plan from the terminal.
 *
 *   billing show    current subscription + the tier table
 *
 * Tier ids are English: free / starter / growth / business. Limits are
 * enforced from day one (LIMIT_REACHED / UPGRADE_REQUIRED).
 */

interface TierDef {
  id: string;
  name: string;
  priceIdr: number;
  blurb: string;
  features: string[];
  serviceLimit: number;
  agentLimit: number;
  brandingRemoval: boolean;
  moduleAccess: boolean;
}

interface BillingInfo {
  subscription: {
    id: string | null;
    accountId: string;
    tier: string;
    status: string;
    currentPeriodEnd: string | null;
  };
  effectiveTier: string;
  earlyAccess: boolean;
  tiers: TierDef[];
}

function fail(e: unknown): never {
  if (e instanceof CliApiError) {
    console.error(chalk.red(`error [${e.code}]`), e.message);
    if (e.requestId) console.error(chalk.dim(`requestId: ${e.requestId}`));
  } else {
    console.error(chalk.red('error'), e instanceof Error ? e.message : String(e));
  }
  process.exit(1);
}

function formatIdr(priceIdr: number): string {
  return priceIdr === 0 ? 'Free' : `Rp ${priceIdr.toLocaleString('en-US')}/mo`;
}

export const billing = new Command('billing').description('Workspace plan + tiers');

billing
  .command('show', { isDefault: true })
  .description('Show the current plan and the tier table')
  .action(async () => {
    try {
      const info = await apiRequest<BillingInfo>('GET', '/api/v1/billing');
      const { subscription: sub, tiers } = info;
      const current = tiers.find((t) => t.id === info.effectiveTier);

      console.log(
        chalk.bold('Current plan:'),
        chalk.green(current?.name ?? info.effectiveTier),
        chalk.dim(`(${sub.status})`),
      );
      if (sub.tier !== info.effectiveTier) {
        console.log(
          chalk.yellow(`Subscription says "${sub.tier}" but it lapsed — limits follow ${info.effectiveTier}.`),
        );
      }
      if (sub.currentPeriodEnd) {
        console.log(chalk.dim(`period ends: ${sub.currentPeriodEnd}`));
      }

      console.log('');
      for (const tier of tiers) {
        const marker = tier.id === info.effectiveTier ? chalk.green('● ') : '  ';
        const perks = [
          `${tier.serviceLimit} services`,
          `${tier.agentLimit} agents`,
          ...(tier.moduleAccess ? ['modules'] : []),
          ...(tier.brandingRemoval ? ['no branding'] : []),
        ].join(', ');
        console.log(
          [
            marker + chalk.bold(tier.name.padEnd(9)),
            formatIdr(tier.priceIdr).padEnd(16),
            chalk.dim(perks),
          ].join(' '),
        );
        console.log(`    ${chalk.dim(tier.blurb)}`);
      }
      console.log(
        chalk.dim('\nUpgrade from the dashboard: https://serront.com/dashboard/billing'),
      );
    } catch (e) {
      fail(e);
    }
  });
