import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class NoCacheHtmlMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send.bind(res);
    res.send = function (body: unknown): Response {
      const contentType = res.getHeader('Content-Type');
      const isHtml =
        typeof contentType === 'string' && contentType.includes('text/html');
      if (isHtml) {
        res.setHeader(
          'Cache-Control',
          'no-cache, no-store, must-revalidate',
        );
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      return originalSend(body);
    };
    next();
  }
}
