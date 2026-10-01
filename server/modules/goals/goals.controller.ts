import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@server/common/auth/auth.guard';
import { CurrentUser } from '@server/common/auth/current-user.decorator';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { MergeGoalsDto } from './dto/merge-goals.dto';

interface CurrentUserPayload {
  userId: string;
  phone: string;
}

@Controller('api')
@UseGuards(AuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('pillars')
  getPillars() {
    return this.goalsService.getPillars();
  }

  @Get('goals')
  async listGoals(@CurrentUser() user: CurrentUserPayload) {
    return this.goalsService.list(user.userId);
  }

  @Post('goals')
  async createGoal(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goalsService.create(user.userId, dto);
  }

  @Get('goals/:id')
  async getGoal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.goalsService.getById(user.userId, id);
  }

  @Patch('goals/:id')
  async updateGoal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(user.userId, id, dto);
  }

  @Delete('goals/:id')
  async deleteGoal(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.goalsService.remove(user.userId, id);
    return { success: true };
  }

  @Post('goals/merge')
  async mergeGoals(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: MergeGoalsDto,
  ) {
    await this.goalsService.merge(user.userId, dto.sourceId, dto.targetId);
    return { success: true };
  }
}
