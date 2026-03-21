import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './common/guards/public.decorator';

/**
 * Root Controller for baseline application validation.
 */
@Public()
@ApiTags('baseline')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Greeting endpoint' })
  @ApiResponse({ status: 200, description: 'Successful greeting' })
  getHello(): string {
    /* eslint-disable i18next/no-literal-string */
    return 'API AI is running';
    /* eslint-enable i18next/no-literal-string */
  }
}
