import { describe, expect, it } from 'vitest'
import { assessDeploymentSource } from '../scripts/deploy-site-policy.mjs'

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
})
