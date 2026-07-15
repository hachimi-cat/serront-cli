import { Command } from 'commander';
import { auth } from './commands/auth.js';
import { storefront } from './commands/storefront.js';
import { services } from './commands/services.js';
import { orders } from './commands/orders.js';
import { billing } from './commands/billing.js';

const brand = process.env.SERRONT ?? 'serront';

const program = new Command()
  .name(brand)
  .description(`CLI for ${brand} — part of the Forjio commerce suite.`)
  .version('0.1.0');

program.addCommand(auth);
program.addCommand(storefront);
program.addCommand(services);
program.addCommand(orders);
program.addCommand(billing);

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
