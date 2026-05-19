import { IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Book context for providing book content to the AI.
 */
export class BookContextDto {
  @ApiPropertyOptional({ description: 'Book ID' })
  @IsString()
  @IsOptional()
  bookId?: string;

  @ApiPropertyOptional({ description: 'Book title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Book content or excerpt' })
  @IsString()
  @IsOptional()
  content?: string;
}

/**
 * DTO for creating a new chat message.
 */
export class CreateMessageDto {
  @ApiProperty({ 
    example: 'What is the main theme of chapter 5?', 
    description: 'Message content' 
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ 
    type: [BookContextDto], 
    description: 'Book context for the conversation' 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookContextDto)
  @IsOptional()
  bookContext?: BookContextDto[];

  @ApiPropertyOptional({ 
    example: false, 
    description: 'Enable RAG to search book content (default: false)' 
  })
  @IsBoolean()
  @IsOptional()
  useRag?: boolean = false;

  @ApiPropertyOptional({ 
    type: [String], 
    description: 'Book IDs to search in for RAG' 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ragBookIds?: string[];
}
