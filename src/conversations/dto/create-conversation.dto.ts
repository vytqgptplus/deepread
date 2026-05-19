import { IsOptional, IsString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Discussion about Chapter 5', description: 'Conversation title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Initial book IDs to associate' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  bookIds?: string[];
}
