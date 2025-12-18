import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from "../configuration";
import { cleanBehaveText } from '../common';
import { diagLog } from '../logger';
import { WkspRun } from './testRunHandler';



export async function runBehaveInstance(wr: WkspRun, parallelMode: boolean,
  args: string[], friendlyCmd: string): Promise<void> {

  let cp: ChildProcess;
  const cancellationHandler = wr.run.token.onCancellationRequested(() => cp?.kill());
  const wkspUri = wr.wkspSettings.uri;

  try {
    const local_args = [...args];
    local_args.unshift("-m", "behave");
    diagLog(`${wr.pythonExec} ${local_args.join(" ")}`, wkspUri);
    // Set PYTHONUNBUFFERED=1 to ensure all print() output is immediately flushed to stdout
    // Without this, Python buffers output when stdout is not a TTY (like when piped to Node.js)
    const env = { ...process.env, ...wr.wkspSettings.envVarOverrides, PYTHONUNBUFFERED: '1' };
    const options: SpawnOptions = { cwd: wkspUri.fsPath, env: env };
    cp = spawn(wr.pythonExec, local_args, options);

    if (!cp.pid) {
      throw `unable to launch python or behave, command: ${wr.pythonExec} ${local_args.join(" ")}\n` +
      `working directory:${wkspUri.fsPath}\nenv var overrides: ${JSON.stringify(wr.wkspSettings.envVarOverrides)}`;
    }

    // Create output file for debugging - write all stdout/stderr to aa.json
    const outputFilePath = path.join(wkspUri.fsPath, 'aa.json');
    
    // Delete old file if it exists
    if (fs.existsSync(outputFilePath)) {
      fs.unlinkSync(outputFilePath);
      config.logger.logInfo(`\nCleared old output file: ${outputFilePath}`, wkspUri);
    }
    
    const outputStream = fs.createWriteStream(outputFilePath, { flags: 'w', encoding: 'utf8' });
    
    const outputData: { timestamp: string, source: string, data: string }[] = [];
    
    outputStream.write('[\n');
    config.logger.logInfo(`Writing all output to: ${outputFilePath}\n`, wkspUri);

    // Set encoding to utf8 to properly handle output
    if (cp.stdout) cp.stdout.setEncoding('utf8');
    if (cp.stderr) cp.stderr.setEncoding('utf8');

    let isFirstEntry = true;
    
    // Log all output to file AND output window
    const log = (source: string, str: string) => {
      if (!str) return;
      
      const entry = {
        timestamp: new Date().toISOString(),
        source: source,
        data: str
      };
      
      outputData.push(entry);
      
      // Write to file
      if (!isFirstEntry) {
        outputStream.write(',\n');
      }
      isFirstEntry = false;
      outputStream.write(JSON.stringify(entry, null, 2));
      
      // Also write to output window
      const cleaned = cleanBehaveText(str);
      config.logger.logInfoNoLF(cleaned, wkspUri);
    }

    // Use data event - simplest and most reliable approach
    cp.stderr?.on('data', (chunk: string) => log('stderr', chunk));
    cp.stdout?.on('data', (chunk: string) => log('stdout', chunk));

    config.logger.logInfo(`\n${friendlyCmd}\n`, wkspUri);

    await new Promise((resolve) => {
      cp.on('close', () => {
        // Close the output file
        outputStream.write('\n]\n');
        outputStream.end();
        
        const totalEntries = outputData.length;
        const stdoutEntries = outputData.filter(e => e.source === 'stdout').length;
        const stderrEntries = outputData.filter(e => e.source === 'stderr').length;
        
        config.logger.logInfo(`\n\nOutput file written: ${outputFilePath}`, wkspUri);
        config.logger.logInfo(`Total entries: ${totalEntries} (stdout: ${stdoutEntries}, stderr: ${stderrEntries})`, wkspUri);
        
        resolve("");
      });
    });

    if (wr.run.token.isCancellationRequested)
      config.logger.logInfo(`\n-- TEST RUN ${wr.run.name} CANCELLED --`, wkspUri, wr.run);

  }
  finally {
    cancellationHandler.dispose();
  }

}
