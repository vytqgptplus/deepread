import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiPropertyOptional({ example: 'The Great Gatsby', description: 'Book title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'F. Scott Fitzgerald', description: 'Author name' })
  @IsString()
  @IsOptional()
  author?: string;
}
