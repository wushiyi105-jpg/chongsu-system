import { APP_FILTER } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { AuthCoreModule } from './common/auth/auth-core.module';
import { AuthModule } from './modules/auth/auth.module';
import { GoalsModule } from './modules/goals/goals.module';
import { FragmentsModule } from './modules/fragments/fragments.module';
import { GraphModule } from './modules/graph/graph.module';
import { ExportModule } from './modules/export/export.module';
import { ViewModule } from './modules/view/view.module';
import { NoCacheHtmlMiddleware } from './common/middleware/no-cache-html.middleware';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    AuthCoreModule,
    // ====== @route-section: business-modules START ======
    // Place all business modules here.Do NOT add fallback modules here.
    AuthModule,
    GoalsModule,
    FragmentsModule,
    GraphModule,
    ExportModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(NoCacheHtmlMiddleware).forRoutes('*');
  }
}
