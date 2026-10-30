import React from 'react';
import { Composition, registerRoot } from 'remotion';
import {
  buildAudio10sMotionTestPlan,
  type UnifiedEditPlan,
} from './editPlanSchema';
import {
  VionMasterComposition,
  type VionCompositionProps,
} from './VionComposition';

const DEFAULT_FALLBACK_PLAN: UnifiedEditPlan = buildAudio10sMotionTestPlan({
  projectId: 'proj_default',
  asset: {
    id: 'ast_default',
    kind: 'voiceover-audio',
    fileName: 'voiceover.m4a',
    playbackUrl: 'http://localhost:3000/empty.m4a',
    durationSeconds: 5,
    hasAudioTrack: true,
  },
});

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VionMasterComposition"
      component={
        VionMasterComposition as unknown as React.ComponentType<
          Record<string, unknown>
        >
      }
      durationInFrames={DEFAULT_FALLBACK_PLAN.durationInFrames}
      fps={DEFAULT_FALLBACK_PLAN.fps}
      width={DEFAULT_FALLBACK_PLAN.width}
      height={DEFAULT_FALLBACK_PLAN.height}
      defaultProps={{
        plan: DEFAULT_FALLBACK_PLAN,
      }}
      calculateMetadata={({ props }) => {
        const typedProps = props as unknown as VionCompositionProps;
        const plan = typedProps?.plan ?? DEFAULT_FALLBACK_PLAN;
        return {
          durationInFrames: Math.max(15, Math.round(plan.durationInFrames)),
          fps: plan.fps || 30,
          width: plan.width || 1280,
          height: plan.height || 720,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
