aimport { ChildProcess, spawn, SpawnOptions } from 'child_process';
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
    if (cp.stdout) {
      cp.stdout.setEncoding('utf8');
      // Ensure stream stays in flowing mode to prevent backpressure
      cp.stdout.resume();
    }
    if (cp.stderr) {
      cp.stderr.setEncoding('utf8');
      // Ensure stream stays in flowing mode to prevent backpressure
      cp.stderr.resume();
    }

    // if parallel mode, use a buffer so logs gets written out in a human-readable order
    const asyncBuff: string[] = [];
    
    // Use a batching mechanism to prevent blocking the event loop
    let outputBuffer = '';
    let isProcessing = false;
    
    const flushOutput = () => {
      if (isProcessing || !outputBuffer) return;
      
      isProcessing = true;
      const toProcess = outputBuffer;
      outputBuffer = '';
      
      // Use setImmediate to prevent blocking the event loop
      setImmediate(() => {
        const cleaned = cleanBehaveText(toProcess);
        if (parallelMode) {
          asyncBuff.push(cleaned);
        } else {
          config.logger.logInfoNoLF(cleaned, wkspUri);
        }
        isProcessing = false;
        
        // If more data accumulated while processing, flush again
        if (outputBuffer) {
          flushOutput();
        }
      });
    };

    const log = (str: string) => {
      if (!str) return;
      
      outputBuffer += str;
      
      // Flush periodically or when buffer gets large to prevent memory issues
      if (outputBuffer.length > 8192) {
        flushOutput();
      } else {
        // Defer flush to batch multiple rapid outputs together
        setImmediate(flushOutput);
      }
    };

    // Process data immediately to prevent backpressure
    // Note: chunk is already a string due to setEncoding('utf8')
    cp.stderr?.on('data', (chunk: string) => {
      log(chunk);
    });
    cp.stdout?.on('data', (chunk: string) => {
      log(chunk);
    });

    if (!parallelMode)
      config.logger.logInfo(`\n${friendlyCmd}\n`, wkspUri);

    await new Promise((resolve) => {
      cp.on('close', () => {
        // Ensure any remaining buffered output is flushed before resolving
        if (outputBuffer) {
          const cleaned = cleanBehaveText(outputBuffer);
          if (parallelMode) {
            asyncBuff.push(cleaned);
          } else {
            config.logger.logInfoNoLF(cleaned, wkspUri);
          }
          outputBuffer = '';
        }
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
