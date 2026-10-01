import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@server/common/auth/auth.guard';
import { CurrentUser } from '@server/common/auth/current-user.decorator';
import { GraphService } from './graph.service';
import type { GraphData, DashboardData } from '@shared/api.interface';

@Controller('api')
@UseGuards(AuthGuard)
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('graph')
  async getGraph(
    @CurrentUser() user: { userId: string; phone: string },
  ): Promise<GraphData> {
    return this.graphService.getGraphData(user.userId);
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: { userId: string; phone: string },
  ): Promise<DashboardData> {
    return this.graphService.getDashboard(user.userId);
  }
}
