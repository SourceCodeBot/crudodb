export async function flushPromises(): Promise<void> {
  jest.runOnlyPendingTimers();
  await new Promise(setImmediate);
  jest.runOnlyPendingTimers();
}
