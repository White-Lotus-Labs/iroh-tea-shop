import type {
  InterrogationResult,
  ReviewAdapter,
  ReviewInput,
  WorkflowState,
} from '../shared/contracts';
export interface ReviewSnapshot {
  workflowState: WorkflowState;
  activeRequestId: string | null;
  result: InterrogationResult | null;
  error: string | null;
}
/** Request ownership is independent of stations and camera animation. */
export class ReviewSession {
  private snapshot: ReviewSnapshot = {
    workflowState: 'idle',
    activeRequestId: null,
    result: null,
    error: null,
  };
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  constructor(private readonly adapter: ReviewAdapter) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<ReviewSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  onPour = async (input: ReviewInput): Promise<InterrogationResult> => {
    if (this.controller) throw new Error('A review is already being poured.');
    const controller = new AbortController();
    this.controller = controller;
    this.publish({
      workflowState: 'fetching',
      activeRequestId: input.requestId,
      error: null,
      result: null,
    });
    try {
      const result = await this.adapter.review(input, controller.signal);
      if (this.controller !== controller || controller.signal.aborted)
        throw new DOMException('Review cancelled', 'AbortError');
      if (result.requestId !== input.requestId)
        throw new Error(
          'The review response did not match this request. Please retry.',
        );
      this.publish({ workflowState: 'result', activeRequestId: null, result });
      return result;
    } catch (error) {
      if (this.controller === controller)
        this.publish({
          workflowState: controller.signal.aborted ? 'idle' : 'error',
          activeRequestId: null,
          error: controller.signal.aborted
            ? null
            : error instanceof Error
              ? error.message
              : 'Review failed. Please retry.',
        });
      throw error;
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  };
  cancel = () => {
    this.controller?.abort();
    this.controller = null;
    this.publish({ workflowState: 'idle', activeRequestId: null, error: null });
  };
}
