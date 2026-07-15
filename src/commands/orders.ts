import { Command } from 'commander';
import chalk from 'chalk';
import { apiRequest, CliApiError } from '../lib/api.js';

/**
 * `serront orders …` — the order desk from the terminal.
 *
 *   orders list [--status requested|confirmed|declined|in_progress|
 *                         delivered|completed|canceled|all]
 *               [--payment-status unpaid|payment_claimed|payment_confirmed|all]
 *               [--service <id>] [--q "…"] [--limit N]
 *   orders show <id>
 *   orders reply <id> --message "…" [--internal] [--author-name "…"]
 *   orders confirm-payment <id>
 *
 * Auth = SERRONT_TOKEN (an sk_live_… API key) or the session from
 * `auth login`, sent as Bearer against serront.com.
 */

interface OrderService {
  id: string;
  slug: string;
  name: string;
  pricingType: string;
}

export interface Order {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  packageName: string | null;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  preferredDate: string | null;
  notes: string;
  quotedPriceIdr: number;
  discountCode: string | null;
  discountAmountIdr: number;
  hasProof: boolean;
  lastMessageAt: string;
  createdAt: string;
  service: OrderService;
}

interface OrderMessage {
  id: string;
  authorType: string;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  requested: chalk.yellow,
  confirmed: chalk.green,
  in_progress: chalk.cyan,
  delivered: chalk.blue,
  completed: chalk.dim,
  declined: chalk.red,
  canceled: chalk.dim,
};

const PAYMENT_COLORS: Record<string, (s: string) => string> = {
  unpaid: chalk.red,
  payment_claimed: chalk.yellow,
  payment_confirmed: chalk.green,
};

function paintStatus(status: string): string {
  return (STATUS_COLORS[status] ?? chalk.white)(status);
}

function paintPayment(status: string): string {
  return (PAYMENT_COLORS[status] ?? chalk.white)(status);
}

function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString('en-US')}`;
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

export const orders = new Command('orders').description('Manage service orders');

orders
  .command('list')
  .description('List orders (newest activity first)')
  .option(
    '--status <status>',
    'filter: requested|confirmed|declined|in_progress|delivered|completed|canceled|all',
  )
  .option('--payment-status <status>', 'filter: unpaid|payment_claimed|payment_confirmed|all')
  .option('--service <id>', 'filter to orders of one service')
  .option('--q <text>', 'free-text search: buyer, notes, messages, service name')
  .option('--limit <n>', 'max orders to return (1-100)', (v) => parseInt(v, 10))
  .action(
    async (opts: {
      status?: string;
      paymentStatus?: string;
      service?: string;
      q?: string;
      limit?: number;
    }) => {
      try {
        const { orders: rows, counts } = await apiRequest<{
          orders: Order[];
          counts: Record<string, number>;
        }>('GET', '/api/v1/orders', {
          query: {
            status: opts.status,
            paymentStatus: opts.paymentStatus,
            serviceId: opts.service,
            q: opts.q,
            limit: opts.limit,
          },
        });

        if (rows.length === 0) {
          console.log(chalk.dim('No orders.'));
        } else {
          for (const o of rows) {
            const pkg = o.packageName ? ` / ${o.packageName}` : '';
            console.log(
              [
                chalk.bold(`#${o.number}`.padEnd(6)),
                paintStatus(o.status).padEnd(21), // padded incl. color codes
                paintPayment(o.paymentStatus).padEnd(27),
                `${o.service.name}${pkg}`,
                chalk.dim(formatIdr(o.quotedPriceIdr)),
                chalk.dim(`(${o.buyerName}, ${o.id})`),
              ].join(' '),
            );
          }
        }
        const summary = Object.entries(counts)
          .map(([s, n]) => `${s}: ${n}`)
          .join('  ');
        if (summary) console.log(chalk.dim(`\n${summary}`));
      } catch (e) {
        fail(e);
      }
    },
  );

orders
  .command('show <id>')
  .description('Show an order with its full message thread')
  .action(async (id: string) => {
    try {
      const o = await apiRequest<Order & { messages: OrderMessage[] }>(
        'GET',
        `/api/v1/orders/${encodeURIComponent(id)}`,
      );
      const pkg = o.packageName ? ` / ${o.packageName}` : '';
      console.log(chalk.bold(`#${o.number} ${o.service.name}${pkg}`));
      console.log(`${paintStatus(o.status)} · ${paintPayment(o.paymentStatus)} · ${chalk.dim(o.id)}`);
      console.log(`buyer:     ${o.buyerName} <${o.buyerEmail}>${o.buyerPhone ? ` ${o.buyerPhone}` : ''}`);
      const discount = o.discountCode
        ? ` (code ${o.discountCode}, −${formatIdr(o.discountAmountIdr)})`
        : '';
      console.log(`quote:     ${formatIdr(o.quotedPriceIdr)}${discount}`);
      if (o.preferredDate) console.log(`preferred: ${o.preferredDate}`);
      if (o.notes) console.log(`notes:     ${o.notes}`);
      if (o.hasProof) console.log(chalk.cyan('payment proof uploaded'));
      console.log(chalk.dim(`created:   ${o.createdAt}`));
      for (const m of o.messages) {
        const who = m.authorName ?? m.authorType;
        const tag = m.isInternal ? chalk.yellow(' [internal]') : '';
        console.log(`\n${chalk.bold(who)} ${chalk.dim(`(${m.authorType}, ${m.createdAt})`)}${tag}`);
        console.log(m.body);
      }
    } catch (e) {
      fail(e);
    }
  });

orders
  .command('reply <id>')
  .description('Reply to an order (visible to the buyer by default)')
  .requiredOption('--message <text>', 'reply body')
  .option('--internal', 'post as an internal note (not visible to the buyer)')
  .option('--author-name <name>', 'display name shown to the buyer')
  .action(async (id: string, opts: { message: string; internal?: boolean; authorName?: string }) => {
    try {
      const m = await apiRequest<{ id: string; isInternal: boolean }>(
        'POST',
        `/api/v1/orders/${encodeURIComponent(id)}/messages`,
        {
          body: {
            body: opts.message,
            ...(opts.internal ? { isInternal: true } : {}),
            ...(opts.authorName ? { authorName: opts.authorName } : {}),
          },
        },
      );
      const kind = opts.internal ? 'Internal note' : 'Reply';
      console.log(chalk.green(`${kind} posted`), chalk.dim(`(${m.id})`));
    } catch (e) {
      fail(e);
    }
  });

orders
  .command('confirm-payment <id>')
  .description('Confirm the payment (unpaid|payment_claimed → payment_confirmed)')
  .action(async (id: string) => {
    try {
      const o = await apiRequest<Order>(
        'POST',
        `/api/v1/orders/${encodeURIComponent(id)}/confirm-payment`,
      );
      console.log(
        chalk.green(`Payment confirmed for order #${o.number}`),
        chalk.dim(`(${formatIdr(o.quotedPriceIdr)})`),
      );
    } catch (e) {
      fail(e);
    }
  });
