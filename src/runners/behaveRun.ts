import { ChildProcess, spawn, SpawnOptions } from 'child_process';
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

    // Set encoding to utf8 to properly handle output
    // Use readable event for manual flow control - this puts stream in paused mode
    // DO NOT use resume() with readable event as they conflict
    if (cp.stdout) {
      cp.stdout.setEncoding('utf8');
    }
    if (cp.stderr) {
      cp.stderr.setEncoding('utf8');
    }

    // if parallel mode, use a buffer so logs gets written out in a human-readable order
    const asyncBuff: string[] = [];
    
    // Use readable event with manual flow control to prevent data loss
    // This ensures we read all data at the stream's natural pace
    // The stream will emit 'readable' when there's data available
    if (cp.stdout) {
      cp.stdout.on('readable', () => {
        let chunk;
        while (null !== (chunk = cp.stdout?.read())) {
          const str = chunk.toString();
          const cleaned = cleanBehaveText(str);
          if (parallelMode) {
            asyncBuff.push(cleaned);
          } else {
            config.logger.logInfoNoLF(cleaned, wkspUri);
          }
        }
      });
      
      // Also listen for 'end' to catch any final data
      cp.stdout.on('end', () => {
        let chunk;
        while (null !== (chunk = cp.stdout?.read())) {
          const str = chunk.toString();
          const cleaned = cleanBehaveText(str);
          if (parallelMode) {
            asyncBuff.push(cleaned);
          } else {
            config.logger.logInfoNoLF(cleaned, wkspUri);
          }
        }
      });
    }
    
    if (cp.stderr) {
      cp.stderr.on('readable', () => {
        let chunk;
        while (null !== (chunk = cp.stderr?.read())) {
          const str = chunk.toString();
          const cleaned = cleanBehaveText(str);
          if (parallelMode) {
            asyncBuff.push(cleaned);
          } else {
            config.logger.logInfoNoLF(cleaned, wkspUri);
          }
        }
      });
      
      // Also listen for 'end' to catch any final data
      cp.stderr.on('end', () => {
        let chunk;
        while (null !== (chunk = cp.stderr?.read())) {
          const str = chunk.toString();
          const cleaned = cleanBehaveText(str);
          if (parallelMode) {
            asyncBuff.push(cleaned);
          } else {
            config.logger.logInfoNoLF(cleaned, wkspUri);
          }
        }
      });
    }

    if (!parallelMode)
      config.logger.logInfo(`\n${friendlyCmd}\n`, wkspUri);

    await new Promise((resolve) => {
      cp.on('close', () => {
        resolve("");
      });
    });

    if (asyncBuff.length > 0) {
      config.logger.logInfo(`\n---\n${friendlyCmd}\n`, wkspUri);
      config.logger.logInfo(asyncBuff.join("").trim(), wkspUri);
      config.logger.logInfo("---", wkspUri);
    }

    if (wr.run.token.isCancellationRequested)
      config.logger.logInfo(`\n-- TEST RUN ${wr.run.name} CANCELLED --`, wkspUri, wr.run);

  }
  finally {
    cancellationHandler.dispose();
  }

}
