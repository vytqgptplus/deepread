import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConversationDto {
  @ApiPropertyOptional({ example: 'Updated title', description: 'New conversation title' })
  @IsString()
  @IsOptional()
  title?: string;
}
