import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddBooksDto {
  @ApiProperty({ type: [String], description: 'Book IDs to add' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  bookIds: string[];
}
