export interface SingleFlight<T> {
  isRunning(): boolean
  run(): Promise<T>
}

export function createSingleFlight<T>(operation: () => Promise<T>): SingleFlight<T> {
  let active: Promise<T> | undefined
  return {
    isRunning: () => Boolean(active),
    run: () => {
      if (!active) {
        active = operation().finally(() => { active = undefined })
      }
      return active
    },
  }
}
