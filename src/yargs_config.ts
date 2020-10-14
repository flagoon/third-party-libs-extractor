import yargs, { Arguments } from 'yargs';

export const argv = yargs
         .usage('Usage: $0 <command> [options]')
         .command('single', 'export 3rd party libraries data from single project')
         .command('multi', 'export 3rd party libraries from multiple projects')
         .command('prepare', 'updating all folders')
         .options({
           team: {
             description: 'give name of team that uses this app',
             type: 'string',
             alias: 't'
           },
           used: {
             description: 'give release name',
             type: 'string',
             alias: 'u'
           }
         })
         .check((yargs: Arguments): boolean => {
           if (yargs._.length !== 1) {
             throw new Error('Require only one command [single, multi, prepare]');
           }
           return true;
         })
         .help()
         .strict().argv;