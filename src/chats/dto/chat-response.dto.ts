import { ApiProperty } from '@nestjs/swagger';
import { Citation } from '../entities/message.entity';

export class ChatResponseDto {
  @ApiProperty({ description: 'Generated response content' })
  content: string;

  @ApiProperty({ type: [Object], description: 'Citations from book content' })
  citations: Citation[];

  @ApiProperty({ description: 'Token usage' })
  tokens?: number;

  @ApiProperty({ description: 'Model used' })
  model?: string;
}
