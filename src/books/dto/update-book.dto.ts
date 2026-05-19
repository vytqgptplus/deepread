import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBookDto {
  @ApiPropertyOptional({ example: 'Updated Title', description: 'Book title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated Author', description: 'Author name' })
  @IsString()
  @IsOptional()
  author?: string;
}
