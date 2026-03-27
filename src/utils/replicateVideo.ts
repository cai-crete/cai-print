// src/utils/replicateVideo.ts
import Replicate from 'replicate';

/**
 * Replicate API를 사용하여 두 이미지 사이의 3D 프레임 보간 영상을 생성합니다.
 * @param image1Url 첫 번째 이미지의 URL (Base64 또는 Public URL)
 * @param image2Url 두 번째 이미지의 URL
 * @returns 생성된 영상의 URL
 */
export async function create_transition_video(image1Url: string, image2Url: string): Promise<string> {
  const replicateToken = (import.meta as any).env?.VITE_REPLICATE_API_TOKEN || '';
  
  if (!replicateToken) {
    throw new Error('REPLICATE_API_TOKEN is not defined in .env (VITE_REPLICATE_API_TOKEN)');
  }

  const replicate = new Replicate({
    auth: replicateToken,
  });

  console.log('Starting 3D Frame Interpolation...');
  
  try {
    const output = await replicate.run(
      "google-research/frame-interpolation:4f0a2569e2c4c37574ea6d1c79e658e44186595bf63a0333d455cd9139f4a080",
      {
        input: {
          frame1: image1Url,
          frame2: image2Url,
          times_to_interpolate: 4
        }
      }
    );

    // Replicate returns the output URL(s)
    console.log('Video Generation Success:', output);
    return Array.isArray(output) ? output[0] : (output as unknown as string);
  } catch (error) {
    console.error('Error in create_transition_video:', error);
    throw error;
  }
}
