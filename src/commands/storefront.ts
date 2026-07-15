import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest, CliApiError } from '../lib/api.js';

/**
 * `serront storefront …` — the seller's public profile from the
 * terminal.
 *
 *   storefront get                     current settings
 *   storefront set [--slug …] [--name …] [--bio …] [--whatsapp +62…]
 *                  [--publish | --unpublish]
 *                  [--hide-branding | --show-branding]
 *
 * PUT /api/v1/storefront is a full replace, so `set` reads the current
 * settings first and merges the flags over them (first-time setup
 * requires at least --slug and --name).
 */

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

interface StorefrontSettings {
  slug: string;
  displayName: string;
  bio: string;
  whatsappNumber: string | null;
  manualBankAccounts: BankAccount[];
  manualInstructions: string | null;
  hideBranding: boolean;
  published: boolean;
  updatedAt: string;
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

function printSettings(s: StorefrontSettings): void {
  console.log(chalk.bold(s.displayName), chalk.dim(`(/s/${s.slug})`));
  console.log(
    s.published ? chalk.green('published') : chalk.yellow('unpublished'),
    '·',
    s.hideBranding ? 'branding hidden' : 'Serront branding shown',
  );
  if (s.bio) console.log(`bio:       ${s.bio}`);
  if (s.whatsappNumber) console.log(`whatsapp:  ${s.whatsappNumber}`);
  if (s.manualBankAccounts.length > 0) {
    console.log('bank accounts:');
    for (const b of s.manualBankAccounts) {
      console.log(`  ${b.bankName} ${b.accountNumber} (${b.accountHolder})`);
    }
  }
  if (s.manualInstructions) console.log(`instructions: ${s.manualInstructions}`);
  console.log(chalk.dim(`updated:   ${s.updatedAt}`));
}

export const storefront = new Command('storefront').description("Manage the storefront profile");

storefront
  .command('get', { isDefault: true })
  .description('Show the current storefront settings')
  .action(async () => {
    try {
      const settings = await apiRequest<StorefrontSettings | null>('GET', '/api/v1/storefront');
      if (!settings) {
        console.log(chalk.dim('No storefront yet. Run `serront storefront set --slug … --name …`.'));
        return;
      }
      printSettings(settings);
    } catch (e) {
      fail(e);
    }
  });

storefront
  .command('set')
  .description('Update storefront settings (merged over the current ones)')
  .option('--slug <slug>', 'public URL slug (globally unique)')
  .option('--name <name>', 'display name')
  .option('--bio <text>', 'short description shown to buyers')
  .option('--whatsapp <e164>', 'WhatsApp contact (E.164, e.g. +62812…)')
  .option('--publish', 'make the storefront publicly reachable')
  .option('--unpublish', 'take the storefront offline')
  .option('--hide-branding', 'hide "Powered by Serront" (Starter+ plans)')
  .option('--show-branding', 'show "Powered by Serront" again')
  .action(
    async (opts: {
      slug?: string;
      name?: string;
      bio?: string;
      whatsapp?: string;
      publish?: boolean;
      unpublish?: boolean;
      hideBranding?: boolean;
      showBranding?: boolean;
    }) => {
      try {
        if (opts.publish && opts.unpublish) {
          throw new CliApiError(0, 'VALIDATION_ERROR', 'pass --publish or --unpublish, not both');
        }
        if (opts.hideBranding && opts.showBranding) {
          throw new CliApiError(
            0,
            'VALIDATION_ERROR',
            'pass --hide-branding or --show-branding, not both',
          );
        }
        const current = await apiRequest<StorefrontSettings | null>('GET', '/api/v1/storefront');
        const slug = opts.slug ?? current?.slug;
        const displayName = opts.name ?? current?.displayName;
        if (!slug || !displayName) {
          throw new CliApiError(
            0,
            'VALIDATION_ERROR',
            'first-time setup needs both --slug and --name',
          );
        }
        const body = {
          slug,
          displayName,
          bio: opts.bio ?? current?.bio ?? '',
          whatsappNumber: opts.whatsapp ?? current?.whatsappNumber ?? null,
          manualBankAccounts: current?.manualBankAccounts ?? [],
          manualInstructions: current?.manualInstructions ?? null,
          hideBranding: opts.hideBranding
            ? true
            : opts.showBranding
              ? false
              : (current?.hideBranding ?? false),
          published: opts.publish ? true : opts.unpublish ? false : (current?.published ?? false),
        };
        const updated = await apiRequest<StorefrontSettings>('PUT', '/api/v1/storefront', { body });
        console.log(chalk.green('Storefront saved.'));
        printSettings(updated);
      } catch (e) {
        fail(e);
      }
    },
  );
