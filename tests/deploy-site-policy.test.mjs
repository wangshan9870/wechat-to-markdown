import { describe, expect, it } from 'vitest'
import {
  assessDeploymentSource,
  deploymentRetryDelayMs,
  isRetriableDeploymentFailure,
} from '../scripts/deploy-site-policy.mjs'

describe('manual site deployment policy', () => {
  it('allows a clean commit from a non-main worktree to reach production', () => {
    const assessment = assessDeploymentSource({
      branch: 'site/wx2md-launch',
      changes: '',
      productionBranch: 'main',
    })

    expect(assessment.blocker).toBe('')
    expect(assessment.warnings).toEqual([
      '当前 commit 来自 site/wx2md-launch；将显式发布到 Cloudflare 生产分支 main。',
    ])
  })

  it('blocks deployment when the worktree contains uncommitted changes', () => {
    const assessment = assessDeploymentSource({
      branch: 'main',
      changes: ' M site/index.html',
      productionBranch: 'main',
    })

    expect(assessment.blocker).toContain('工作区存在未提交改动')
  })

  it('retries only transient network and Cloudflare service failures', () => {
    expect(isRetriableDeploymentFailure('A fetch request failed, likely due to a connectivity issue.')).toBe(true)
    expect(isRetriableDeploymentFailure('HTTP status code 503')).toBe(true)
    expect(isRetriableDeploymentFailure('Authentication error: insufficient permissions')).toBe(false)
    expect(isRetriableDeploymentFailure('Project wx2md does not exist')).toBe(false)
  })

  it('backs off between the three total deployment attempts', () => {
    expect(deploymentRetryDelayMs(1)).toBe(2_000)
    expect(deploymentRetryDelayMs(2)).toBe(5_000)
  })
})
