import { describe, expect, it, vi } from 'vitest'
import manifest from '../src/manifest'
import { createSingleFlight } from '../src/core/single-flight'

const staticManifest = manifest as unknown as {
  version: string
  commands: Record<string, { suggested_key?: { default?: string } }>
}

describe('quick save command', () => {
  it('registers the WeChat shortcut and feature version', () => {
    expect(staticManifest.version).toBe('0.3.0')
    expect(staticManifest.commands['quick-save']?.suggested_key?.default).toBe('Alt+Shift+W')
  })

  it('deduplicates concurrent save operations', async () => {
    let resolve!: (value: string) => void
    const operation = vi.fn()
      .mockImplementationOnce(() => new Promise<string>((done) => { resolve = done }))
      .mockResolvedValue('saved')
    const save = createSingleFlight(operation)
    const first = save.run()
    const second = save.run()
    expect(save.isRunning()).toBe(true)
    expect(operation).toHaveBeenCalledTimes(1)
    resolve('saved')
    await expect(Promise.all([first, second])).resolves.toEqual(['saved', 'saved'])
    expect(save.isRunning()).toBe(false)
    await save.run()
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
