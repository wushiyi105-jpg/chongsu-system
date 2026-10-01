import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import type { VoiceTranscribeRequest, VoiceTranscribeResponse } from '@shared/api.interface';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly capabilityService: CapabilityService) {}

  async transcribe(req: VoiceTranscribeRequest): Promise<VoiceTranscribeResponse> {
    if (!req.audioUrl?.trim()) {
      throw new BadRequestException('音频URL不能为空');
    }

    try {
      const result = await this.capabilityService
        .load('speech_to_text_recording_convert_1')
        .call('speechToText', {
          audio_file: [req.audioUrl],
          language: req.language || 'zh',
        });

      const text = (result as { text?: string })?.text?.trim() || '';
      this.logger.log(`语音转写成功，长度: ${text.length}`);

      return { text };
    } catch (error) {
      const errMsg =
        (error as { message?: string })?.message ||
        (error as { error_msg?: string })?.error_msg ||
        String(error);
      this.logger.error(`语音转写失败: ${errMsg}`);
      throw new InternalServerErrorException(errMsg);
    }
  }
}
