import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@server/common/auth/auth.guard';
import { CurrentUser } from '@server/common/auth/current-user.decorator';
import { FragmentsService } from './fragments.service';
import { CreateFragmentDto } from './dto/create-fragment.dto';
import { UpdateFragmentDto } from './dto/update-fragment.dto';
import { BindTagsDto } from './dto/bind-tags.dto';
import { ParseLinkDto } from './dto/parse-link.dto';
import { VoiceService } from './voice.service';
import type {
  Fragment,
  FragmentListResponse,
  FragmentType,
  PillarKey,
  ParseLinkResponse,
  VoiceTranscribeRequest,
  VoiceTranscribeResponse,
} from '@shared/api.interface';

interface CurrentUserPayload {
  userId: string;
  phone: string;
}

@Controller('api/fragments')
@UseGuards(AuthGuard)
export class FragmentsController {
  constructor(
    private readonly fragmentsService: FragmentsService,
    private readonly voiceService: VoiceService,
  ) {}

  @Get()
   async list(
     @CurrentUser() user: CurrentUserPayload,
     @Query('page') page?: string,
     @Query('pageSize') pageSize?: string,
     @Query('type') type?: string,
     @Query('pillar') pillar?: PillarKey,
     @Query('goalId') goalId?: string,
   ): Promise<FragmentListResponse> {
     const normalizedType = type === 'image' ? 'text' : type as FragmentType | undefined;
     return this.fragmentsService.list(user.userId, {
       page: page ? parseInt(page, 10) : undefined,
       pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
       type: normalizedType,
       pillar,
       goalId,
     });
   }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateFragmentDto,
  ): Promise<Fragment> {
    return this.fragmentsService.create(user.userId, dto);
  }

  @Post('parse-link')
  async parseLink(
    @Body() dto: ParseLinkDto,
  ): Promise<ParseLinkResponse> {
    return this.fragmentsService.parseLink(dto.url);
  }

  @Post('transcribe-voice')
  async transcribeVoice(
    @Body() body: VoiceTranscribeRequest,
  ): Promise<VoiceTranscribeResponse> {
    return this.voiceService.transcribe(body);
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<Fragment> {
    return this.fragmentsService.getById(user.userId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFragmentDto,
  ): Promise<Fragment> {
    return this.fragmentsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.fragmentsService.remove(user.userId, id);
  }

  @Post(':id/tags')
  async bindTags(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: BindTagsDto,
  ): Promise<Fragment> {
    return this.fragmentsService.bindTags(user.userId, id, dto.tagIds);
  }

  @Delete(':id/tags/:goalId')
  async unbindTag(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Param('goalId') goalId: string,
  ): Promise<void> {
    return this.fragmentsService.unbindTag(user.userId, id, goalId);
  }
}
