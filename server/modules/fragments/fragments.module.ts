import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FragmentsController } from './fragments.controller';
import { FragmentsService } from './fragments.service';
import { TikHubService } from './tikhub.service';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  controllers: [FragmentsController],
  providers: [FragmentsService, TikHubService, VoiceService],
  exports: [TikHubService],
})
export class FragmentsModule {}
