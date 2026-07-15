import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest, CliApiError } from '../lib/api.js';

/**
 * `serront services …` — the catalog from the terminal.
 *
 *   services list
 *   services create --slug <slug> --name <name>
 *                   (--price <idr> [--hourly] | --package "Name=price" …)
 *                   [--description "…"] [--inactive]
 *
 * Pricing: --price alone = fixed; --price + --hourly = hourly base
 * rate; repeated --package flags = package pricing (1-5 packages).
 */

interface ServicePackage {
  name: string;
  priceIdr: number;
  description?: string;
}

interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  pricingType: string;
  priceIdr: number | null;
  packages: ServicePackage[] | null;
  active: boolean;
  sortOrder: number;
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

function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString('en-US')}`;
}

function priceLabel(s: Service): string {
  if (s.pricingType === 'package') {
    const pkgs = s.packages ?? [];
    return `${pkgs.length} packages (${pkgs.map((p) => `${p.name} ${formatIdr(p.priceIdr)}`).join(', ')})`;
  }
  const base = s.priceIdr != null ? formatIdr(s.priceIdr) : '—';
  return s.pricingType === 'hourly' ? `${base}/hr` : base;
}

function collectPackage(value: string, previous: ServicePackage[]): ServicePackage[] {
  const eq = value.lastIndexOf('=');
  const name = eq > 0 ? value.slice(0, eq).trim() : '';
  const price = eq > 0 ? Number.parseInt(value.slice(eq + 1), 10) : NaN;
  if (!name || !Number.isInteger(price) || price < 0) {
    throw new CliApiError(
      0,
      'VALIDATION_ERROR',
      `--package must be "Name=priceIdr" (got "${value}")`,
    );
  }
  return [...previous, { name, priceIdr: price }];
}

export const services = new Command('services').description('Manage the service catalog');

services
  .command('list')
  .description('List all services (sortOrder asc)')
  .action(async () => {
    try {
      const rows = await apiRequest<Service[]>('GET', '/api/v1/services');
      if (rows.length === 0) {
        console.log(chalk.dim('No services. Run `serront services create …`.'));
        return;
      }
      for (const s of rows) {
        console.log(
          [
            s.active ? chalk.green('●') : chalk.dim('○'),
            chalk.bold(s.name),
            chalk.dim(`(${s.slug})`),
            chalk.dim(s.pricingType.padEnd(7)),
            priceLabel(s),
            chalk.dim(s.id),
          ].join(' '),
        );
      }
    } catch (e) {
      fail(e);
    }
  });

services
  .command('create')
  .description('Create a service')
  .requiredOption('--slug <slug>', 'URL slug, unique per storefront')
  .requiredOption('--name <name>', 'display name')
  .option('--description <text>', 'description shown to buyers')
  .option('--price <idr>', 'base price in whole rupiah (fixed, or hourly with --hourly)', (v) =>
    parseInt(v, 10),
  )
  .option('--hourly', 'price is an hourly rate')
  .option('--package <Name=priceIdr>', 'add a package (repeatable, 1-5)', collectPackage, [])
  .option('--inactive', 'create hidden from the public storefront')
  .action(
    async (opts: {
      slug: string;
      name: string;
      description?: string;
      price?: number;
      hourly?: boolean;
      package: ServicePackage[];
      inactive?: boolean;
    }) => {
      try {
        const hasPackages = opts.package.length > 0;
        if (hasPackages && opts.price !== undefined) {
          throw new CliApiError(0, 'VALIDATION_ERROR', 'use --price OR --package, not both');
        }
        if (!hasPackages && opts.price === undefined) {
          throw new CliApiError(0, 'VALIDATION_ERROR', 'provide --price or at least one --package');
        }
        const body = {
          slug: opts.slug,
          name: opts.name,
          ...(opts.description !== undefined ? { description: opts.description } : {}),
          pricingType: hasPackages ? 'package' : opts.hourly ? 'hourly' : 'fixed',
          ...(hasPackages ? { packages: opts.package } : { priceIdr: opts.price }),
          ...(opts.inactive ? { active: false } : {}),
        };
        const s = await apiRequest<Service>('POST', '/api/v1/services', { body });
        console.log(chalk.green('Service created'), chalk.dim(`(${s.id})`));
        console.log(`${chalk.bold(s.name)} — ${s.pricingType} — ${priceLabel(s)}`);
      } catch (e) {
        fail(e);
      }
    },
  );
