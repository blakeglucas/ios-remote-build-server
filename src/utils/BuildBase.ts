import { Socket } from 'socket.io';
import { getLogger } from '../logger';
import { HandlerBase } from './HandlerBase';

const logger = getLogger(__filename);

export type BuildStep = {
  id?: number;
  order: number;
  requires?: number[];
  name: string;
  // Feedback is communicated through throws, not retcodes
  task: () => void | Promise<void>;
};

// Nomenclature could be confusing here lol
export abstract class BuildBase extends HandlerBase {
  protected buildSteps: BuildStep[] = [];
  protected context: Record<string, any> = {};

  constructor(
    protected readonly socket: Socket,
    protected readonly stepsToRun?: number[]
  ) {
    super(socket, logger);
  }

  abstract createBuildId(): string;
  abstract ensureWorkDir(): void | Promise<void>;
  abstract populateWorkDir(): void | Promise<void>;
  abstract finishBuild(): any | Promise<any>;

  async run() {
    this.createBuildId();
    await this.ensureWorkDir();
    await this.populateWorkDir();
    const sortedSteps = this.buildSteps.sort((a, b) => a.order - b.order);
    for (let i = 0; i < sortedSteps.length; i++) {
      const currentStep = sortedSteps[i];
      this.logMessage(`Starting step "${currentStep.name}"...`);
      try {
        await currentStep.task();
        this.logMessage(`"${currentStep.name}" finished.`);
      } catch (e) {
        this.logError(
          `Step ${currentStep.name} failed with message "${
            (e as Error).message
          }"`
        );
        return;
      }
    }
    this.logMessage('Finalizing...');
    const finalData = await this.finishBuild();
    this.logMessage(`Build ${this.context['buildId']} finished.`);
    return finalData;
  }
}
