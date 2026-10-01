import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@server/common/auth/auth.guard';
import { CurrentUser } from '@server/common/auth/current-user.decorator';
import { ExportService } from './export.service';
import type { ExportRequest, ExportResponse } from '@shared/api.interface';

@Controller('api')
@UseGuards(AuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post('export')
  async exportData(
    @CurrentUser() user: { userId: string; phone: string },
    @Body() body: ExportRequest,
  ): Promise<ExportResponse> {
    return this.exportService.exportData(user.userId, body);
  }
}
